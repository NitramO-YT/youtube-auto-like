/**
 * The update manifest of the Firefox version (updates.json), which Firefox
 * reads at the address of update_url in src/manifest/firefox.json: the file
 * of the latest release, at an address that never changes. It names the
 * signed package of that release, at its own address, with its SHA-256, so
 * that Firefox installs only that very file.
 *
 * Format: "Updating your extension" on MDN (addons, updates, version,
 * update_link, update_hash).
 */
import { REPOSITORY_URL } from '../../src/core/report.js';

export const UPDATES_FILE = 'updates.json';
export const XPI_FILE = 'youtube-auto-like.xpi';

/** The address update_url gives: the update manifest of the latest release. */
export const UPDATE_URL = `${REPOSITORY_URL}/releases/latest/download/${UPDATES_FILE}`;

/** The address of the signed package of one release, whose tag is v<version>. */
export function xpiUrl(version) {
  return `${REPOSITORY_URL}/releases/download/v${version}/${XPI_FILE}`;
}

/**
 * @param {{ id: string, version: string, sha256: string }} release The
 *   Gecko ID, the version of the signed package and its SHA-256 in hex.
 * @returns {object} The content of updates.json.
 */
export function updatesManifest({ id, version, sha256 }) {
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`Not a SHA-256: ${sha256}`);
  return {
    addons: {
      [id]: {
        updates: [{ version, update_link: xpiUrl(version), update_hash: `sha256:${sha256}` }],
      },
    },
  };
}
