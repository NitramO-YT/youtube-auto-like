/**
 * Command-line arguments of the Chromium-family browsers that the scripts
 * start on a throwaway profile: the preview screenshots (preview-ui.mjs) and
 * the packing of the CRX (package.mjs).
 *
 * Both turn extensions off. A fresh profile otherwise installs the extensions
 * that the system registers for every profile, such as the one of the
 * plasma-browser-integration package; its native host then crashes when the
 * browser exits a fraction of a second later. --pack-extension packs with
 * extensions off all the same.
 */

const ISOLATED_PROFILE = ['--no-first-run', '--disable-extensions'];

/** A headless browser on profileDir, followed by extra (what to load, and how). */
export function headlessArgs(profileDir, extra = []) {
  return [
    '--headless=new',
    ...ISOLATED_PROFILE,
    '--no-default-browser-check',
    '--disable-gpu',
    // Scripts loaded from files are otherwise cross-origin to the page,
    // and their errors reach it as a bare "Script error.".
    '--allow-file-access-from-files',
    `--user-data-dir=${profileDir}`,
    ...extra,
  ];
}

/** Packing buildDir into a CRX signed with keyPath, on profileDir. */
export function packArgs(profileDir, buildDir, keyPath) {
  return [`--user-data-dir=${profileDir}`, ...ISOLATED_PROFILE, `--pack-extension=${buildDir}`, `--pack-extension-key=${keyPath}`];
}
