/**
 * The screenshots of the listing on addons.mozilla.org, written into
 * store/screenshots/ from the store- scenarios of scripts/preview/scenarios.mjs
 * (fictional channels, English, light theme), at the size Mozilla shows in
 * full (STORE_SIZE). Their captions are in store/screenshots.json.
 *
 *   npm run store-screenshots
 *
 * The three states of the toolbar popup are set side by side by ImageMagick
 * (magick, or convert of ImageMagick 6), which this script needs.
 *
 * --upload sends the screenshots of store/screenshots/, as they are, to the
 * listing, with their captions, in their order, in place of those it shows:
 *
 *   guichet exec amo-api-key -- guichet exec amo-api-secret -- npm run store-screenshots -- --upload
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { amoKeys, amoRequest } from './lib/amo-api.mjs';
import { findExecutable } from './lib/preview.mjs';
import { STORE_SIZE } from './preview/scenarios.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'store', 'screenshots');
const CAPTIONS = path.join(ROOT, 'store', 'screenshots.json');
const POPUPS = ['store-popup-waiting', 'store-popup-liked', 'store-popup-not-subscribed'];
// Width of a popup, and the gap between two, in the composed image.
const POPUP_WIDTH = 360;
const POPUP_GAP = 40;
const POPUP_TOP = 100;
const BACKGROUND = '#e9ecf1';
// Seconds between two writes to the listing when uploading.
const WRITE_SPACING_S = 20;

const shot = (dir, scenario) => path.join(dir, `${scenario}-en-light.png`);

function imageMagick() {
  const command = findExecutable(['magick', 'convert'], process.env.PATH);
  if (!command) throw new Error('ImageMagick (magick or convert) is needed to set the popups side by side.');
  return command;
}

/** The three popups centered on one image of STORE_SIZE. */
function composePopups(command, dir, target) {
  const [width, height] = STORE_SIZE;
  const left = Math.round((width - POPUPS.length * POPUP_WIDTH - (POPUPS.length - 1) * POPUP_GAP) / 2);
  const layers = POPUPS.flatMap((scenario, index) => [
    shot(dir, scenario),
    '-geometry',
    `+${left + index * (POPUP_WIDTH + POPUP_GAP)}+${POPUP_TOP}`,
    '-composite',
  ]);
  execFileSync(command, ['-size', `${width}x${height}`, `xc:${BACKGROUND}`, ...layers, target]);
}

/**
 * Replaces the screenshots of the listing: those it shows are deleted, then
 * each of store/screenshots.json is sent at its position, and given its
 * caption (a translated field, set by an edit of the preview).
 */
async function upload(shots) {
  const keys = amoKeys();
  // Writes one after the other, apart, so as not to be throttled (see
  // amo-api.mjs).
  const pause = () => new Promise((done) => setTimeout(done, WRITE_SPACING_S * 1000));
  const { gecko } = JSON.parse(await readFile(path.join(ROOT, 'src', 'manifest', 'firefox.json'), 'utf8')).browser_specific_settings;
  const addon = await amoRequest(keys, 'GET', `/addons/addon/${encodeURIComponent(gecko.id)}/`);
  const previews = `/addons/addon/${addon.id}/previews`;
  for (const preview of addon.previews ?? []) {
    await amoRequest(keys, 'DELETE', `${previews}/${preview.id}/`);
    console.log(`deleted the screenshot ${preview.id}`);
    await pause();
  }
  for (const [position, { file, caption }] of shots.entries()) {
    const form = new FormData();
    form.set('image', new Blob([await readFile(path.join(OUT_DIR, file))], { type: 'image/png' }), file);
    form.set('position', String(position));
    const created = await amoRequest(keys, 'POST', `${previews}/`, form);
    await pause();
    await amoRequest(keys, 'PATCH', `${previews}/${created.id}/`, { caption });
    await pause();
    console.log(`sent store/screenshots/${file}, screenshot ${created.id}`);
  }
}

async function main() {
  const { values } = parseArgs({ options: { upload: { type: 'boolean', default: false } } });
  const captions = JSON.parse(await readFile(CAPTIONS, 'utf8'));
  if (values.upload) {
    await upload(captions);
    return;
  }
  const command = imageMagick();
  const workDir = await mkdtemp(path.join(tmpdir(), 'yal-store-'));
  try {
    const preview = spawnSync(
      process.execPath,
      [path.join(ROOT, 'scripts', 'preview-ui.mjs'), '--only', 'store-', '--locales', 'en', '--out', workDir],
      { stdio: 'inherit' },
    );
    if (preview.status !== 0) throw new Error('The preview of the store scenarios failed.');
    await rm(OUT_DIR, { recursive: true, force: true });
    await mkdir(OUT_DIR, { recursive: true });
    for (const { file, scenario } of captions) {
      const target = path.join(OUT_DIR, file);
      if (scenario === 'popups') composePopups(command, workDir, target);
      else await copyFile(shot(workDir, scenario), target);
      console.log(`store/screenshots/${file}`);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
