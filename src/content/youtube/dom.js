/**
 * What the liker reads from, and does to, the DOM of a watch page, from the
 * isolated world. Checked in Brave on 8 November 2026.
 *
 * The rating is read from the aria-pressed attribute of the buttons, which
 * follows every click. The data.isToggled property of the same components
 * keeps the state of the page load and misses any later click, so it must
 * not be used.
 */

const RATING_BAR = 'ytd-menu-renderer.ytd-watch-metadata segmented-like-dislike-button-view-model';
const LIKE_BUTTON = 'like-button-view-model button';
const DISLIKE_BUTTON = 'dislike-button-view-model button';
// The watch page carries the ID of the video its metadata, buttons included,
// belongs to (attribute used by Taknok/youtube-auto-like).
const WATCH_PAGE = 'ytd-watch-flexy';
const PLAYER = '#movie_player';
const VIDEO = '#movie_player video.video-stream';
// Classes of the player while an ad plays (from Taknok/youtube-auto-like; not
// yet observed in this project).
const AD_CLASSES = ['ad-showing', 'ad-interrupting'];

/** The ID of the video a URL points to, or null for any other page. */
export function videoIdFromUrl(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const short = url.pathname.match(/^\/shorts\/([^/?#]+)/);
  return short ? short[1] : null;
}

/** The video ID the watch page shows the buttons of, or null. */
export function watchPageVideoId(doc) {
  return doc.querySelector(WATCH_PAGE)?.getAttribute('video-id') ?? null;
}

function pressed(button) {
  const value = button?.getAttribute('aria-pressed');
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

export function findLikeButton(doc) {
  return doc.querySelector(RATING_BAR)?.querySelector(LIKE_BUTTON) ?? null;
}

/** { liked, disliked }, each null when its button is missing or unreadable. */
export function readRating(doc) {
  const bar = doc.querySelector(RATING_BAR);
  return {
    liked: pressed(bar?.querySelector(LIKE_BUTTON)),
    disliked: pressed(bar?.querySelector(DISLIKE_BUTTON)),
  };
}

/** { position, duration, adPlaying }, with null values when no video is found. */
export function readPlayback(doc) {
  const video = doc.querySelector(VIDEO);
  const player = doc.querySelector(PLAYER);
  return {
    position: video ? video.currentTime : null,
    duration: video ? video.duration : null,
    adPlaying: player ? AD_CLASSES.some((name) => player.classList.contains(name)) : false,
  };
}
