/**
 * Submits the Firefox version of a release to addons.mozilla.org, in the
 * channel "listed" (public listing, at the address of the slug in
 * store/amo-metadata.json), waits for Mozilla to approve and sign it, and
 * writes into releases/:
 * - youtube-auto-like.xpi, the package Mozilla signed, the same file as on
 *   the listing, attached to the GitHub release too, and its .sha256;
 * - updates.json, the update manifest that versions 3.0.0 and 3.1.0 read
 *   (lib/firefox-updates.mjs).
 *
 * The listing (name, summary, description, categories, license, links) is
 * sent from store/amo-metadata.json with each version: that file is where
 * the listing is written, an edit made on the website is replaced at the
 * next release.
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
 *
 * --beta signs a beta in the channel "unlisted" instead: signed but kept off
 * the listing, without sending the listing, and without updates.json (only
 * the latest release carries it). Its version number must be one Mozilla has
 * not signed yet, in either channel.
 *
 * --fetch sends nothing: when Mozilla approved the version later than the
 * wait above (a first listed version can be reviewed by a person), it
 * downloads the signed package of this version and writes the same files.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildExtension } from './build.mjs';
import { amoKeys, amoRequest, amoToken } from './lib/amo-api.mjs';
import { listingProblems } from './lib/amo-metadata.mjs';
import { UPDATES_FILE, updatesManifest, XPI_FILE } from './lib/firefox-updates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_DIR = path.join(ROOT, 'dist', 'firefox');
const SIGNED_DIR = path.join(ROOT, 'dist', 'firefox-signed');
const SOURCE_ARCHIVE = path.join(ROOT, 'dist', 'firefox-source.zip');
const OUT_DIR = path.join(ROOT, 'releases');
const WEB_EXT = path.join(ROOT, 'node_modules', '.bin', 'web-ext');
const METADATA = path.join(ROOT, 'store', 'amo-metadata.json');
// What the build reads, and the listing: none of it may differ from the
// commit sent as source.
const SENT_INPUTS = ['src', 'scripts', 'package.json', 'package-lock.json', 'store'];
// Mozilla may hold a version for review before signing it.
const APPROVAL_TIMEOUT_MS = 30 * 60_000;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  return result;
}

/** Refuses to go on when what is sent differs from HEAD, untracked files included. */
function checkCommitted() {
  const changed = run('git', ['status', '--porcelain', '--', ...SENT_INPUTS]).stdout.trim();
  if (changed) {
    throw new Error(`Commit these first: the source sent to Mozilla is the commit, and the build must come from it.\n${changed}`);
  }
}

/**
 * web-ext lint with Mozilla's rules for a listed add-on (without
 * --self-hosted, which would let an update_url through); an error stops
 * the signing, a warning is shown.
 */
function lint() {
  const result = run(WEB_EXT, ['lint', '--source-dir', BUILD_DIR, '--output', 'json']);
  const report = JSON.parse(result.stdout);
  for (const warning of report.warnings) console.log(`web-ext lint warning: ${warning.code}: ${warning.message}`);
  if (report.errors.length > 0) {
    throw new Error(`web-ext lint found errors:\n${report.errors.map((error) => `${error.code}: ${error.message} (${error.file ?? ''})`).join('\n')}`);
  }
}

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

/**
 * The signed package of a version already sent, once Mozilla approved it
 * (file status "public"), downloaded into SIGNED_DIR; an error while it is
 * still under review.
 */
async function fetchSigned(guid, version) {
  const keys = amoKeys();
  const { results } = await amoRequest(keys, 'GET', `/addons/addon/${encodeURIComponent(guid)}/versions/?filter=all_with_unlisted&page_size=50`);
  const sent = results.find((candidate) => candidate.version === version);
  if (!sent) throw new Error(`Mozilla has no version ${version} of ${guid}: send it first.`);
  if (sent.file?.status !== 'public') {
    throw new Error(`Version ${version} is not approved yet (file status "${sent.file?.status}"): fetch it again later.`);
  }
  const response = await fetch(sent.file.url, { headers: { Authorization: `JWT ${amoToken(keys)}` } });
  if (!response.ok) throw new Error(`Download of ${sent.file.url}: HTTP ${response.status}`);
  await rm(SIGNED_DIR, { recursive: true, force: true });
  await mkdir(SIGNED_DIR, { recursive: true });
  const file = path.join(SIGNED_DIR, `youtube-auto-like-${version}.xpi`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

async function sign(beta) {
  if (!process.env.WEB_EXT_API_KEY || !process.env.WEB_EXT_API_SECRET) {
    throw new Error('Mozilla keys missing: run it through the guichet (guichet exec amo-api-key -- guichet exec amo-api-secret -- npm run sign-firefox).');
  }
  await rm(SIGNED_DIR, { recursive: true, force: true });
  const channel = beta ? ['--channel', 'unlisted'] : ['--channel', 'listed', '--amo-metadata', METADATA];
  const result = run(
    WEB_EXT,
    [
      'sign',
      ...channel,
      '--source-dir', BUILD_DIR,
      '--artifacts-dir', SIGNED_DIR,
      '--upload-source-code', SOURCE_ARCHIVE,
      '--approval-timeout', String(APPROVAL_TIMEOUT_MS),
    ],
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
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      beta: { type: 'boolean', default: false },
      fetch: { type: 'boolean', default: false },
    },
  });
  const { version } = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  let manifest;
  let signed;
  if (values.fetch) {
    // Built only to know the ID and version the signed package must carry.
    manifest = await buildExtension({ target: 'firefox', srcDir: path.join(ROOT, 'src'), outDir: BUILD_DIR, version });
    signed = await fetchSigned(manifest.browser_specific_settings.gecko.id, version);
  } else {
    checkCommitted();
    const problems = listingProblems(JSON.parse(await readFile(METADATA, 'utf8')));
    if (problems.length > 0) throw new Error(`The listing (store/amo-metadata.json) cannot be sent:\n${problems.join('\n')}`);
    manifest = await buildExtension({ target: 'firefox', srcDir: path.join(ROOT, 'src'), outDir: BUILD_DIR, version });
    lint();
    const archived = run('git', ['archive', '--format=zip', '--output', SOURCE_ARCHIVE, 'HEAD']);
    if (archived.status !== 0) throw new Error(`git archive failed: ${archived.stderr}`);
    console.log(`Firefox ${version} built and checked; source archive: ${path.relative(ROOT, SOURCE_ARCHIVE)}.`);
    if (values['dry-run']) {
      console.log('Dry run: nothing sent to Mozilla.');
      return;
    }
    signed = await sign(values.beta);
  }
  checkSigned(signed, manifest);
  await mkdir(OUT_DIR, { recursive: true });
  const xpi = path.join(OUT_DIR, XPI_FILE);
  await rename(signed, xpi);
  await chmod(xpi, 0o644);
  const hash = await sha256(xpi);
  await writeFile(`${xpi}.sha256`, `${hash}  ${XPI_FILE}\n`);
  console.log(`YouTube Auto Like ${version} for Firefox, signed by Mozilla${values.beta ? ' (beta, not listed)' : ''}:`);
  console.log(`  ${path.relative(ROOT, xpi)}  sha256 ${hash}`);
  if (values.beta) return;
  const updates = updatesManifest({ id: manifest.browser_specific_settings.gecko.id, version, sha256: hash });
  await writeFile(path.join(OUT_DIR, UPDATES_FILE), `${JSON.stringify(updates, null, 2)}\n`);
  console.log(`  ${path.join('releases', UPDATES_FILE)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
