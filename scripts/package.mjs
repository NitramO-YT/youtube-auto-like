/**
 * Packages a release of the extension into releases/:
 * - youtube-auto-like.zip, to load unpacked (developer mode);
 * - youtube-auto-like.crx, signed with extension-key.pem, which gives it the
 *   ID pinned in src/manifest/chromium.json (scripts/extension-identity.mjs);
 * - a .sha256 file next to each, which `sha256sum -c` checks.
 * The names carry no version, so that the address of the latest release's
 * file never changes (releases/latest/download/youtube-auto-like.zip); the
 * version is the one of package.json, given to the build.
 *
 * The CRX is packed by a Chromium-family browser started on a throwaway
 * profile (with the user's own profile, a running browser would receive the
 * command instead of a new process), like openiera-browser-bridge does.
 *
 * Usage: npm run package [-- --no-crx]
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildExtension } from './build.mjs';
import { checkIdentity, PRIVATE_KEY_PATH } from './extension-identity.mjs';
import { packArgs } from './lib/browser-args.mjs';
import { zipFiles } from './lib/zip.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'releases');
const BUILD_DIR = path.join(ROOT, 'dist', 'chromium');
const NAME = 'youtube-auto-like';
// Google Chrome and Brave first; the Chromium of the snap only sees the
// home folder, where the profile below is.
const PACKERS = ['google-chrome', 'google-chrome-stable', 'brave-browser', 'brave', 'chromium', 'chromium-browser'];

/** Every file of a folder, as { name, data }, names with "/" and sorted. */
async function filesOf(dir, prefix = '') {
  const files = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await filesOf(full, name)));
    else files.push({ name, data: await readFile(full) });
  }
  return files;
}

/** Writes name.sha256 next to the file, in the format of sha256sum. */
async function writeChecksum(file) {
  const hash = createHash('sha256').update(await readFile(file)).digest('hex');
  await writeFile(`${file}.sha256`, `${hash}  ${path.basename(file)}\n`);
  return hash;
}

function findPacker() {
  return PACKERS.find((command) => spawnSync('sh', ['-c', `command -v ${command}`]).status === 0) ?? null;
}

async function packCrx(out) {
  const identity = await checkIdentity();
  if (!identity.consistent) {
    throw new Error('The private key and the manifest give different extension IDs: see node scripts/extension-identity.mjs --check.');
  }
  await stat(PRIVATE_KEY_PATH).catch(() => {
    throw new Error(`Private key not found: ${PRIVATE_KEY_PATH} (restore it from its backup, never make a new one).`);
  });
  const packer = findPacker();
  if (!packer) throw new Error(`No Chromium-family browser found (${PACKERS.join(', ')}).`);
  const profile = path.join(ROOT, 'dist', 'pack-profile');
  const packed = `${BUILD_DIR}.crx`;
  await rm(packed, { force: true });
  try {
    const result = spawnSync(packer, packArgs(profile, BUILD_DIR, PRIVATE_KEY_PATH), {
      encoding: 'utf8',
      timeout: 60_000,
    });
    await stat(packed).catch(() => {
      throw new Error(`Packing failed with ${packer}:\n${result.stdout}${result.stderr}`);
    });
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
  await rename(packed, out);
  // Written 600 by the browser; a signed package holds no secret.
  await chmod(out, 0o644);
  const check = await checkIdentity({ crxPath: out });
  if (!check.consistent) throw new Error(`The CRX carries another extension ID than ${check.expected}.`);
  return packer;
}

async function main() {
  const { values } = parseArgs({ options: { 'no-crx': { type: 'boolean', default: false } } });
  const { version } = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  await buildExtension({ target: 'chromium', srcDir: path.join(ROOT, 'src'), outDir: BUILD_DIR, version });
  await mkdir(OUT_DIR, { recursive: true });

  const zip = path.join(OUT_DIR, `${NAME}.zip`);
  await writeFile(zip, zipFiles(await filesOf(BUILD_DIR)));
  const written = [[zip, await writeChecksum(zip)]];

  if (!values['no-crx']) {
    const crx = path.join(OUT_DIR, `${NAME}.crx`);
    const packer = await packCrx(crx);
    written.push([crx, await writeChecksum(crx)]);
    console.log(`CRX packed with ${packer}.`);
  }
  console.log(`YouTube Auto Like ${version}:`);
  for (const [file, hash] of written) console.log(`  ${path.relative(ROOT, file)}  sha256 ${hash}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
