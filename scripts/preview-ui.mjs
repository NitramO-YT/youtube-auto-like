/**
 * Screenshots of the extension pages in every scenario of
 * scripts/preview/scenarios.mjs, language and theme, taken by a headless
 * Chromium, with a stand-in for the extension API. It checks what unit
 * tests cannot: that the pages load, render and run without a JavaScript
 * error. It never touches the browser profile in use: the browser runs on a
 * temporary profile, and the extension is built apart from dist/chromium/.
 *
 * Usage: npm run preview [-- --out <dir>] [--only <text>] [--browser <path>]
 *   --out      folder of the screenshots (default dist/preview/)
 *   --only     keeps the scenarios whose name contains <text>
 *   --browser  Chromium-based browser to run; also PREVIEW_BROWSER
 *
 * Exits with code 1 when a page reports an error or cannot be checked.
 */
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { buildExtension } from './build.mjs';
import { findExecutable, injectScripts, readErrors } from './lib/preview.mjs';
import { SCENARIOS } from './preview/scenarios.mjs';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The browser in daily use comes last: any other is preferred for a preview.
const BROWSERS = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'brave-browser'];
// Values of the preferredColorScheme Blink setting.
const THEMES = { light: 1, dark: 0 };
const BROWSER_TIMEOUT_MS = 60_000;
// Virtual time given to a page to load, answer its first status and render.
const RENDER_BUDGET_MS = 4_000;

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

/** Writes the preview page of a scenario next to the page it shows; returns its path. */
async function writePreviewPage(extensionDir, scenario, locale, version) {
  const pageFile = path.join(extensionDir, scenario.page);
  const id = `preview-${scenario.name}-${locale}`;
  const messages = await readJson(path.join(extensionDir, '_locales', locale, 'messages.json'));
  const root = `${path.relative(path.dirname(pageFile), extensionDir).split(path.sep).join('/')}/`;
  const preview = {
    messages,
    version,
    root,
    settings: scenario.settings,
    stats: scenario.stats ?? { likeCount: 1248 },
    history: scenario.history,
    status: scenario.status,
  };
  await writeFile(path.join(path.dirname(pageFile), `${id}.data.js`), `window.PREVIEW = ${JSON.stringify(preview)};\n`);
  const fakeApi = path.relative(path.dirname(pageFile), path.join(extensionDir, 'preview-fake-api.js'));
  const html = injectScripts(await readFile(pageFile, 'utf8'), [`${id}.data.js`, fakeApi.split(path.sep).join('/')]);
  const previewFile = path.join(path.dirname(pageFile), `${id}.html`);
  await writeFile(previewFile, html);
  return previewFile;
}

async function headless(browser, profileDir, args) {
  const { stdout } = await run(
    browser,
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      // Scripts loaded from files are otherwise cross-origin to the page,
      // and their errors reach it as a bare "Script error.".
      '--allow-file-access-from-files',
      `--user-data-dir=${profileDir}`,
      ...args,
    ],
    { timeout: BROWSER_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 },
  );
  return stdout;
}

async function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: path.join(ROOT, 'dist', 'preview') },
      only: { type: 'string', default: '' },
      browser: { type: 'string', default: process.env.PREVIEW_BROWSER ?? '' },
    },
  });
  const browser = values.browser || findExecutable(BROWSERS, process.env.PATH);
  if (!browser) {
    console.error(`No Chromium-based browser found (${BROWSERS.join(', ')}). Give one with --browser or PREVIEW_BROWSER.`);
    process.exitCode = 1;
    return;
  }
  const scenarios = SCENARIOS.filter((scenario) => scenario.name.includes(values.only));
  if (scenarios.length === 0) {
    console.error(`No scenario matches "${values.only}".`);
    process.exitCode = 1;
    return;
  }

  const outDir = path.resolve(values.out);
  const extensionDir = path.join(outDir, 'extension');
  const { version } = await readJson(path.join(ROOT, 'package.json'));
  await rm(outDir, { recursive: true, force: true });
  await buildExtension({ target: 'chromium', srcDir: path.join(ROOT, 'src'), outDir: extensionDir, version });
  await copyFile(path.join(ROOT, 'scripts', 'preview', 'fake-api.js'), path.join(extensionDir, 'preview-fake-api.js'));
  const locales = (await readdir(path.join(extensionDir, '_locales'))).sort();
  const profileDir = await mkdtemp(path.join(tmpdir(), 'yal-preview-profile-'));

  let failures = 0;
  try {
    for (const scenario of scenarios) {
      for (const locale of locales) {
        const url = pathToFileURL(await writePreviewPage(extensionDir, scenario, locale, version)).href + (scenario.query ?? '');
        for (const [theme, scheme] of Object.entries(THEMES)) {
          const name = `${scenario.name}-${locale}-${theme}`;
          const common = [`--blink-settings=preferredColorScheme=${scheme}`, `--virtual-time-budget=${RENDER_BUDGET_MS}`];
          const [width, height] = scenario.size;
          await headless(browser, profileDir, [...common, `--window-size=${width},${height}`, `--screenshot=${path.join(outDir, `${name}.png`)}`, url]);
          const errors = readErrors(await headless(browser, profileDir, [...common, '--dump-dom', url]));
          if (errors === null || errors.length > 0) {
            failures += 1;
            console.error(`✖ ${name}: ${errors === null ? 'the preview did not run' : errors.join(' | ')}`);
          } else {
            console.log(`✔ ${name}`);
          }
        }
      }
    }
  } finally {
    await rm(profileDir, { recursive: true, force: true });
  }

  console.log(`Screenshots in ${path.relative(process.cwd(), outDir) || outDir}/`);
  if (failures > 0) {
    console.error(`${failures} page(s) with errors.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
