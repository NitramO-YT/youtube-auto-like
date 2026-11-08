/**
 * One running copy of each content script per page. The extension injects
 * its scripts again into the YouTube tabs already open when it is installed
 * or updated, and a page may then hold an older copy next to the new one.
 * Each copy takes its turn when it starts, with a token of its own under a
 * key shared by every copy in the same world; a copy whose token is no
 * longer there knows a newer one runs, and stops.
 */

/**
 * Takes the turn for this copy.
 *
 * @param {object} global The global object of the world (window or globalThis).
 * @param {symbol} key From Symbol.for, so that every copy finds the same one.
 * @returns {() => boolean} Whether this copy still has the turn.
 */
export function claimInstance(global, key) {
  const token = {};
  Object.defineProperty(global, key, { value: token, configurable: true, writable: true, enumerable: false });
  return () => global[key] === token;
}

/**
 * Whether the extension that injected a content script is still there. When
 * the extension is disabled, reloaded, updated or removed, the scripts
 * already in a page keep running, cut off from it: runtime.id is then
 * undefined.
 */
export function isConnected(api) {
  try {
    return Boolean(api?.runtime?.id);
  } catch {
    // Reading runtime of a cut-off extension can throw in some browsers.
    return false;
  }
}
