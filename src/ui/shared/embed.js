/**
 * The options page shown inside the popup, in a frame: the same page, with
 * ?embedded in its address. It then hides what the popup already shows (its
 * header with the switch, the paused banner, the menu of sections), through
 * the data-embedded attribute that ui/boot.js sets on <html> before the
 * first paint.
 */

export const EMBED_PARAM = 'embedded';
export const OPTIONS_PAGE = 'ui/options/options.html';

export function isEmbedded(location) {
  return new URLSearchParams(location.search).has(EMBED_PARAM);
}

/** Address of the options page for the frame of the popup. */
export function embeddedOptionsUrl(getURL) {
  return `${getURL(OPTIONS_PAGE)}?${EMBED_PARAM}`;
}
