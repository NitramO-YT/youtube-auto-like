/**
 * What the build produces. Paths are relative to src/ for sources and to the
 * build folder (dist/<target>/) for outputs.
 */

// Browser targets. Each one has its manifest overlay in src/manifest/<target>.json.
export const TARGETS = ['chromium'];

// Folders of src/ copied unchanged into the build.
export const STATIC_DIRS = ['_locales', 'icons'];

// Scripts bundled by esbuild, one per extension context (service worker,
// content script, page), as { in: 'path/to/source.js', out: 'path/to/output' }.
// The output name has no extension: esbuild adds .js.
export const ENTRY_POINTS = [
  { in: 'content/page/index.js', out: 'content/page' },
  { in: 'content/isolated/index.js', out: 'content/isolated' },
];
