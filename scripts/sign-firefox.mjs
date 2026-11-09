/**
 * Signs the Firefox version of a release with Mozilla, for self-distribution
 * (channel "unlisted": signed, not listed on addons.mozilla.org), and writes
 * into releases/:
 * - youtube-auto-like.xpi, the package Mozilla signed, and its .sha256;
 * - updates.json, the update manifest Firefox reads (lib/firefox-updates.mjs).
 *
 * Mozilla signs each version only once: run it for the version to publish,
 * from a committed tree, since the build is sent with the source code it
 * comes from (git archive of HEAD), which Mozilla asks for code assembled by
 * a tool such as esbuild. The keys come from the environment, as web-ext
 * reads them (WEB_EXT_API_KEY, WEB_EXT_API_SECRET):
 *
 *   guichet exec amo-api-key -- guichet exec amo-api-secret -- npm run sign-firefox
 *
 * --dry-run does everything but the sending: build, checks by web-ext lint,
 * source archive.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildExtension } from './build.mjs';
import { UPDATES_FILE, updatesManifest, XPI_FILE } from './lib/firefox-updates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_DIR = path.join(ROOT, 'dist', 'firefox');
const SIGNED_DIR = path.join(ROOT, 'dist', 'firefox-signed');
const SOURCE_ARCHIVE = path.join(ROOT, 'dist', 'firefox-source.zip');
const OUT_DIR = path.join(ROOT, 'releases');
const WEB_EXT = path.join(ROOT, 'node_modules', '.bin', 'web-ext');
// What the build reads: none of it may differ from the commit sent as source.
const BUILD_INPUTS = ['src', 'scripts', 'package.json', 'package-lock.json'];
// Mozilla may hold a version for review before signing it.
const APPROVAL_TIMEOUT_MS = 30 * 60_000;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  return result;
}

/** Refuses to go on when the build inputs differ from HEAD, untracked files included. */
function checkCommitted() {
  const changed = run('git', ['status', '--porcelain', '--', ...BUILD_INPUTS]).stdout.trim();
  if (changed) {
    throw new Error(`Commit these first: the source sent to Mozilla is the commit, and the build must come from it.\n${changed}`);
  }
}

/** web-ext lint with Mozilla's rules; an error stops the signing, a warning is shown. */
function lint() {
  const result = run(WEB_EXT, ['lint', '--source-dir', BUILD_DIR, '--self-hosted', '--output', 'json']);
  const report = JSON.parse(result.stdout);
  for (const warning of report.warnings) console.log(`web-ext lint warning: ${warning.code}: ${warning.message}`);
  if (report.errors.length > 0) {
    throw new Error(`web-ext lint found errors:\n${report.errors.map((error) => `${error.code}: ${error.message} (${error.file ?? ''})`).join('\n')}`);
  }
}

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function sign() {
  if (!process.env.WEB_EXT_API_KEY || !process.env.WEB_EXT_API_SECRET) {
    throw new Error('Mozilla keys missing: run it through the guichet (guichet exec amo-api-key -- guichet exec amo-api-secret -- npm run sign-firefox).');
  }
  await rm(SIGNED_DIR, { recursive: true, force: true });
  const result = run(
    WEB_EXT,
    ['sign', '--channel', 'unlisted', '--source-dir', BUILD_DIR, '--artifacts-dir', SIGNED_DIR, '--upload-source-code', SOURCE_ARCHIVE, '--approval-timeout', String(APPROVAL_TIMEOUT_MS)],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) throw new Error(`web-ext sign failed (exit code ${result.status}).`);
  const packages = (await readdir(SIGNED_DIR)).filter((name) => name.endsWith('.xpi'));
  if (packages.length !== 1) throw new Error(`Expected one signed package in ${SIGNED_DIR}, found: ${packages.join(', ') || 'none'}.`);
  return path.join(SIGNED_DIR, packages[0]);
}

/** The signed package must carry Mozilla's signature and the manifest that was built. */
function checkSigned(xpi, manifest) {
  const names = run('unzip', ['-Z1', xpi]).stdout.split('\n');
  if (!names.includes('META-INF/cose.sig')) throw new Error(`${xpi} carries no Mozilla signature (META-INF/cose.sig).`);
  const signed = JSON.parse(run('unzip', ['-p', xpi, 'manifest.json']).stdout);
  const id = signed.browser_specific_settings?.gecko?.id;
  if (id !== manifest.browser_specific_settings.gecko.id || signed.version !== manifest.version) {
    throw new Error(`The signed package is ${id} ${signed.version}, not ${manifest.browser_specific_settings.gecko.id} ${manifest.version}.`);
  }
}

async function main() {
  const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
  checkCommitted();
  const { version } = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const manifest = await buildExtension({ target: 'firefox', srcDir: path.join(ROOT, 'src'), outDir: BUILD_DIR, version });
  lint();
  const archived = run('git', ['archive', '--format=zip', '--output', SOURCE_ARCHIVE, 'HEAD']);
  if (archived.status !== 0) throw new Error(`git archive failed: ${archived.stderr}`);
  console.log(`Firefox ${version} built and checked; source archive: ${path.relative(ROOT, SOURCE_ARCHIVE)}.`);
  if (values['dry-run']) {
    console.log('Dry run: nothing sent to Mozilla.');
    return;
  }

  const signed = await sign();
  checkSigned(signed, manifest);
  await mkdir(OUT_DIR, { recursive: true });
  const xpi = path.join(OUT_DIR, XPI_FILE);
  await rename(signed, xpi);
  await chmod(xpi, 0o644);
  const hash = await sha256(xpi);
  await writeFile(`${xpi}.sha256`, `${hash}  ${XPI_FILE}\n`);
  const updates = updatesManifest({ id: manifest.browser_specific_settings.gecko.id, version, sha256: hash });
  await writeFile(path.join(OUT_DIR, UPDATES_FILE), `${JSON.stringify(updates, null, 2)}\n`);
  console.log(`YouTube Auto Like ${version} for Firefox, signed by Mozilla:`);
  console.log(`  ${path.relative(ROOT, xpi)}  sha256 ${hash}`);
  console.log(`  ${path.join('releases', UPDATES_FILE)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
