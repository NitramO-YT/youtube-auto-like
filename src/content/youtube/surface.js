/**
 * The two places a video plays in: the regular watch page, and the Shorts
 * player. Which one is shown follows from the URL. Both page worlds use this,
 * so that the reader and the liker always look at the same surface.
 */

export const Surface = Object.freeze({ WATCH: 'watch', SHORTS: 'shorts' });

function parse(href) {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}

/** Surface.WATCH, Surface.SHORTS, or null for a page that plays no video. */
export function surfaceFromUrl(href) {
  const url = parse(href);
  if (!url) return null;
  if (url.pathname === '/watch' && url.searchParams.get('v')) return Surface.WATCH;
  if (/^\/shorts\/[^/?#]+/.test(url.pathname)) return Surface.SHORTS;
  return null;
}

/** The ID of the video a URL points to, or null for any other page. */
export function videoIdFromUrl(href) {
  const url = parse(href);
  if (!url) return null;
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const short = url.pathname.match(/^\/shorts\/([^/?#]+)/);
  return short ? short[1] : null;
}
