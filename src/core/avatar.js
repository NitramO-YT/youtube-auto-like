/**
 * Channel avatars: images the popup and the options page load from YouTube's
 * servers. Any other address is refused, by avatarUrl and by the content
 * security policy of the extension pages, whose img-src lists the same hosts
 * (a test checks that both agree).
 */

// yt3.ggpht.com observed on 8 November 2026.
export const AVATAR_HOSTS = Object.freeze(['yt3.ggpht.com', 'yt3.googleusercontent.com', 'yt4.ggpht.com']);

/** The address, normalized, when it is an https image of an avatar host; otherwise null. */
export function avatarUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && AVATAR_HOSTS.includes(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}
