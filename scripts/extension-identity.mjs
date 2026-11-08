/**
 * Extension identity on Chromium: the extension ID derives from an RSA key
 * pair, and two places must agree on it.
 *
 * - src/manifest/chromium.json, "key" field: the public key. A copy loaded
 *   unpacked in developer mode takes its ID from it, so the ID, and with it the
 *   extension's storage, does not depend on the folder the build is loaded from.
 * - extension-key.pem at the repository root (gitignored, mode 600): the
 *   private key that signs the CRX, whose signed header carries the same ID.
 *   Losing it means moving every installation to a new ID, which loses its
 *   settings: keep a backup outside the repository.
 *
 * Usage:
 *   node scripts/extension-identity.mjs --current        ID from the manifest key
 *   node scripts/extension-identity.mjs --check [crx]    check that the private key and
 *                                                        the manifest agree (and the ID
 *                                                        signed into a CRX, if given)
 *   node scripts/extension-identity.mjs --new-identity   create a key pair (refused if
 *                                                        extension-key.pem exists) and
 *                                                        print the public key to pin
 *
 * ID derivation, as in Chromium: SHA-256 of the DER (SPKI) public key, first
 * 16 bytes, each nibble mapped to a letter from "a" to "p", high nibble first,
 * giving the 32-letter extension ID.
 */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const MANIFEST_KEY_PATH = path.join(ROOT, 'src', 'manifest', 'chromium.json');
export const PRIVATE_KEY_PATH = path.join(ROOT, 'extension-key.pem');

const USAGE = `Usage:
  node scripts/extension-identity.mjs --current
  node scripts/extension-identity.mjs --check [path/to/package.crx]
  node scripts/extension-identity.mjs --new-identity`;

// CrxFileHeader field holding SignedData, and SignedData field holding the ID.
const CRX_SIGNED_HEADER_FIELD = 10000;
const SIGNED_DATA_CRX_ID_FIELD = 1;

export function idFromBytes(bytes) {
  return [...bytes]
    .flatMap((byte) => [byte >> 4, byte & 15])
    .map((nibble) => String.fromCharCode(97 + nibble))
    .join('');
}

export function idFromDer(der) {
  return idFromBytes(createHash('sha256').update(der).digest().subarray(0, 16));
}

export async function idFromManifest(manifestPath = MANIFEST_KEY_PATH) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!manifest.key) throw new Error(`no "key" field in ${manifestPath}`);
  return idFromDer(Buffer.from(manifest.key, 'base64'));
}

export async function idFromPrivateKey(pemPath = PRIVATE_KEY_PATH) {
  const privateKey = createPrivateKey(await readFile(pemPath, 'utf8'));
  return idFromDer(createPublicKey(privateKey).export({ type: 'spki', format: 'der' }));
}

function readVarint(buffer, offset) {
  let value = 0;
  let shift = 0;
  let byte;
  do {
    if (offset >= buffer.length) throw new Error('truncated protobuf in CRX header');
    byte = buffer[offset++];
    value += (byte & 0x7f) * 2 ** shift;
    shift += 7;
  } while (byte & 0x80);
  return [value, offset];
}

// First length-delimited field with the given number, or null.
function protobufField(buffer, wanted) {
  let offset = 0;
  while (offset < buffer.length) {
    let key;
    [key, offset] = readVarint(buffer, offset);
    const field = Math.floor(key / 8);
    const wireType = key % 8;
    if (wireType === 2) {
      let length;
      [length, offset] = readVarint(buffer, offset);
      if (field === wanted) return buffer.subarray(offset, offset + length);
      offset += length;
    } else if (wireType === 0) {
      [, offset] = readVarint(buffer, offset);
    } else if (wireType === 1) {
      offset += 8;
    } else if (wireType === 5) {
      offset += 4;
    } else {
      throw new Error(`unsupported protobuf wire type ${wireType} in CRX header`);
    }
  }
  return null;
}

/**
 * CRX3 layout: "Cr24", uint32 version (3), uint32 header size, then a
 * CrxFileHeader protobuf whose signed_header_data is a SignedData message
 * carrying the 16-byte crx_id, the ID Chromium installs the package under.
 */
export async function idFromCrx(crxPath) {
  const buffer = await readFile(crxPath);
  if (buffer.subarray(0, 4).toString('latin1') !== 'Cr24' || buffer.readUInt32LE(4) !== 3) {
    throw new Error(`${crxPath} is not a CRX3 package`);
  }
  const header = buffer.subarray(12, 12 + buffer.readUInt32LE(8));
  const signedData = protobufField(header, CRX_SIGNED_HEADER_FIELD);
  const crxId = signedData && protobufField(signedData, SIGNED_DATA_CRX_ID_FIELD);
  if (!crxId || crxId.length !== 16) throw new Error(`no signed crx_id in ${crxPath}`);
  return idFromBytes(crxId);
}

/**
 * Compares every available source with the manifest ID. The private key is
 * optional: only packing a CRX needs it. Returns { expected, sources, consistent }.
 */
export async function checkIdentity({
  manifestPath = MANIFEST_KEY_PATH,
  pemPath = PRIVATE_KEY_PATH,
  crxPath,
} = {}) {
  const expected = await idFromManifest(manifestPath);
  const sources = [{ label: 'manifest key', where: path.relative(ROOT, manifestPath), id: expected }];
  try {
    sources.push({ label: 'private key', where: path.relative(ROOT, pemPath), id: await idFromPrivateKey(pemPath) });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    sources.push({ label: 'private key', where: path.relative(ROOT, pemPath), id: null });
  }
  if (crxPath) {
    sources.push({ label: 'signed CRX', where: path.relative(ROOT, path.resolve(crxPath)), id: await idFromCrx(crxPath) });
  }
  const consistent = sources.every(({ id }) => id === null || id === expected);
  return { expected, sources, consistent };
}

/**
 * Writes a new private key, never over an existing one, and returns the
 * public key to pin with the ID it gives.
 */
export async function createIdentity(pemPath = PRIVATE_KEY_PATH) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  await writeFile(pemPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), {
    mode: 0o600,
    flag: 'wx',
  });
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return { publicKey: der.toString('base64'), id: idFromDer(der) };
}

async function main([mode, argument]) {
  if (mode === '--current') {
    console.log(`Extension ID (from the manifest key): ${await idFromManifest()}`);
  } else if (mode === '--check') {
    const { expected, sources, consistent } = await checkIdentity({ crxPath: argument });
    for (const { label, where, id } of sources) {
      let status = 'ok';
      if (id === null) status = 'absent (only needed to pack a CRX)';
      else if (id !== expected) status = `MISMATCH: ${id}`;
      console.log(`${label.padEnd(15)}${where.padEnd(32)}${status}`);
    }
    console.log(consistent ? `Extension ID: ${expected}` : `Identity mismatch: the manifest key gives ${expected}.`);
    process.exitCode = consistent ? 0 : 1;
  } else if (mode === '--new-identity') {
    const { publicKey, id } = await createIdentity();
    console.log(`Private key written to ${PRIVATE_KEY_PATH} (mode 600, gitignored). Back it up outside the repository.`);
    console.log(`Pin this public key in src/manifest/chromium.json, "key" field:\n${publicKey}`);
    console.log(`Extension ID: ${id}`);
  } else {
    console.error(USAGE);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      error.code === 'EEXIST'
        ? 'extension-key.pem already exists: the current identity is kept. Delete it only ' +
            'to move every installation to a new extension ID.'
        : `extension-identity: ${error.message}`,
    );
    process.exitCode = 1;
  });
}
