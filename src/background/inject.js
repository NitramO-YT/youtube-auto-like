/**
 * Injects the content scripts into the YouTube tabs already open, when the
 * extension is installed or updated: the browser only injects them into
 * pages loaded afterwards, so without this the user would have to reload
 * each tab. A copy left from the previous version stops itself when the new
 * one starts (see content/instance.js).
 *
 * The scripts and their worlds are read from the content_scripts of the
 * manifest, the one place that declares them. The API is passed in, so that
 * tests can use a fake one.
 */

const LOG_PREFIX = '[YouTube Auto Like]';

/** @returns {Promise<number>} How many tabs received the scripts. */
export async function injectIntoOpenTabs(api) {
  const entries = api.runtime.getManifest().content_scripts ?? [];
  const patterns = [...new Set(entries.flatMap((entry) => entry.matches))];
  const tabs = await api.tabs.query({ url: patterns });
  let injected = 0;
  for (const tab of tabs) {
    // A discarded tab reloads when it is shown again, and the browser
    // injects the scripts then.
    if (tab.discarded) continue;
    try {
      // In the order of the manifest: the page reader before the liker.
      for (const entry of entries) {
        await api.scripting.executeScript({ target: { tabId: tab.id }, files: entry.js, world: entry.world ?? 'ISOLATED' });
      }
      injected += 1;
    } catch (error) {
      // A tab closing, or showing an error page, refuses the scripts; the
      // others still get them.
      console.error(LOG_PREFIX, `could not inject the content scripts into tab ${tab.id}`, error);
    }
  }
  return injected;
}
