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

/**
 * Whether a tab holds no page yet: discarded, or "unloaded" (a status of
 * Chromium, which Firefox does not have). Its page loads when the tab is
 * shown, and the browser injects the scripts then; injecting now is refused
 * ("Cannot access contents of the page"), as seen in Brave on 12 November
 * 2026 for the YouTube tabs of a window not shown since the browser started.
 */
export function holdsNoPage(tab) {
  return tab.discarded === true || tab.status === 'unloaded';
}

/** @returns {Promise<number>} How many tabs received the scripts. */
export async function injectIntoOpenTabs(api) {
  const entries = api.runtime.getManifest().content_scripts ?? [];
  const patterns = [...new Set(entries.flatMap((entry) => entry.matches))];
  const tabs = await api.tabs.query({ url: patterns });
  let injected = 0;
  for (const tab of tabs) {
    if (holdsNoPage(tab)) continue;
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
