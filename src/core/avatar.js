/**
 * Channel avatars: images the popup and the options page load from YouTube's
 * servers. Any other address is refused, by avatarUrl and by the content
 * security policy of the extension pages, whose img-src lists the same hosts
 * (a test checks that both agree).
 */

// yt3.ggpht.com observed on 8 November 2026.
export const AVATAR_HOSTS = Object.freeze(['yt3.ggpht.com', 'yt3.googleusercontent.com', 'yt4.ggpht.com']);
// Avatar addresses observed on YouTube on 8 November 2026 are about 130
// characters long. A longer one is not stored with a channel, a video or a
// like: it bounds the size of the lists in storage and in an export file.
export const MAX_STORED_AVATAR_URL_LENGTH = 300;

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

/** The avatar address kept with a list entry or a like: avatarUrl, within MAX_STORED_AVATAR_URL_LENGTH; otherwise null. */
export function storedAvatarUrl(value) {
  const url = avatarUrl(value);
  return url && url.length <= MAX_STORED_AVATAR_URL_LENGTH ? url : null;
}
