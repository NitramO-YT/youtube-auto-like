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
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

async function main() {
  const command = imageMagick();
  const captions = JSON.parse(await readFile(CAPTIONS, 'utf8'));
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
