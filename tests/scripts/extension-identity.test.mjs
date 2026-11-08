import assert from 'node:assert/strict';
import { createPublicKey, createPrivateKey } from 'node:crypto';
import { access, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  checkIdentity,
  createIdentity,
  idFromBytes,
  idFromCrx,
  idFromDer,
  idFromManifest,
  idFromPrivateKey,
  MANIFEST_KEY_PATH,
  PRIVATE_KEY_PATH,
} from '../../scripts/extension-identity.mjs';

const ID_PATTERN = /^[a-p]{32}$/;

function varint(value) {
  const bytes = [];
  do {
    let byte = value % 128;
    value = Math.floor(value / 128);
    if (value > 0) byte += 128;
    bytes.push(byte);
  } while (value > 0);
  return Buffer.from(bytes);
}

function lengthDelimited(field, payload) {
  return Buffer.concat([varint(field * 8 + 2), varint(payload.length), payload]);
}

// Minimal CRX3: magic, version, header size, then a CrxFileHeader holding an
// unrelated field before signed_header_data (10000), itself holding crx_id (1).
function fakeCrx(crxId) {
  const signedData = lengthDelimited(1, crxId);
  const header = Buffer.concat([lengthDelimited(2, Buffer.from('proof')), lengthDelimited(10000, signedData)]);
  const prefix = Buffer.alloc(12);
  prefix.write('Cr24', 0, 'latin1');
  prefix.writeUInt32LE(3, 4);
  prefix.writeUInt32LE(header.length, 8);
  return Buffer.concat([prefix, header, Buffer.from('zip payload')]);
}

describe('extension identity', () => {
  let workDir;

  before(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'yal-identity-test-'));
  });

  after(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('maps each nibble to a letter from a to p, high nibble first', () => {
    assert.equal(idFromBytes(Buffer.from([0x00, 0x1f, 0xf0, 0xab])), 'aabppakl');
    assert.equal(idFromBytes(Buffer.alloc(16, 0xff)), 'p'.repeat(32));
  });

  it('creates a key pair whose private and public halves give the same 32-letter ID', async () => {
    const pemPath = path.join(workDir, 'key.pem');
    const { publicKey, id } = await createIdentity(pemPath);
    assert.match(id, ID_PATTERN);
    assert.equal(idFromDer(Buffer.from(publicKey, 'base64')), id);
    assert.equal(await idFromPrivateKey(pemPath), id);
    assert.equal((await stat(pemPath)).mode & 0o777, 0o600);
  });

  it('never overwrites an existing private key', async () => {
    const pemPath = path.join(workDir, 'kept.pem');
    await createIdentity(pemPath);
    const before = await readFile(pemPath, 'utf8');
    await assert.rejects(createIdentity(pemPath), { code: 'EEXIST' });
    assert.equal(await readFile(pemPath, 'utf8'), before);
  });

  it('reads the ID signed into a CRX3 header', async () => {
    const crxPath = path.join(workDir, 'package.crx');
    const crxId = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
    await writeFile(crxPath, fakeCrx(crxId));
    assert.equal(await idFromCrx(crxPath), 'aabbccddeeffgghhiijjkkllmmnnoopp');
  });

  it('refuses a file that is not a CRX3 package', async () => {
    const notCrx = path.join(workDir, 'not.crx');
    await writeFile(notCrx, 'PK\u0003\u0004 a zip file');
    await assert.rejects(idFromCrx(notCrx), /not a CRX3 package/);
  });

  it('reports a mismatch between the manifest key and the private key', async () => {
    const pemPath = path.join(workDir, 'other.pem');
    const { publicKey } = await createIdentity(path.join(workDir, 'pinned.pem'));
    await createIdentity(pemPath);
    const manifestPath = path.join(workDir, 'chromium.json');
    await writeFile(manifestPath, JSON.stringify({ key: publicKey }));
    const result = await checkIdentity({ manifestPath, pemPath });
    assert.equal(result.consistent, false);
  });

  it('pins a public key in the project manifest that matches the local private key, when present', async (t) => {
    const id = await idFromManifest(MANIFEST_KEY_PATH);
    assert.match(id, ID_PATTERN);
    try {
      await access(PRIVATE_KEY_PATH);
    } catch {
      t.skip('extension-key.pem is not on this machine');
      return;
    }
    const pinned = JSON.parse(await readFile(MANIFEST_KEY_PATH, 'utf8')).key;
    const derived = createPublicKey(createPrivateKey(await readFile(PRIVATE_KEY_PATH, 'utf8')))
      .export({ type: 'spki', format: 'der' })
      .toString('base64');
    assert.equal(pinned, derived);
    assert.equal((await checkIdentity()).consistent, true);
  });
});
