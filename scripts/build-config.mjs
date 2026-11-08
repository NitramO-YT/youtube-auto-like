/**
 * What the build produces. Paths are relative to src/ for sources and to the
 * build folder (dist/<target>/) for outputs.
 */

// Browser targets. Each one has its manifest overlay in src/manifest/<target>.json.
export const TARGETS = ['chromium'];

// Folders and files of src/ copied unchanged into the build, at the same path.
// A page is listed file by file: its folder also holds the JavaScript sources
// that esbuild bundles.
export const STATIC_PATHS = ['_locales', 'icons', 'ui/popup/popup.html'];

// Scripts bundled by esbuild, one per extension context (service worker,
// content script, page), as { in: 'path/to/source.js', out: 'path/to/output' }.
// The output name has no extension: esbuild adds .js, and .css when the
// script imports a stylesheet.
export const ENTRY_POINTS = [
  { in: 'content/page/index.js', out: 'content/page' },
  { in: 'content/isolated/index.js', out: 'content/isolated' },
  { in: 'ui/popup/index.js', out: 'ui/popup/popup' },
];
