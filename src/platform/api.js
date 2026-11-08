/**
 * The WebExtension API. Firefox and Chromium 148+ expose it as `browser`;
 * older Chromium versions only as `chrome`. In Manifest V3, both return
 * promises.
 */
export const api = globalThis.browser ?? globalThis.chrome;
