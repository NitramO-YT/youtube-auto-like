/**
 * What the liker reads from, and does to, the DOM of the surface playing the
 * video, from the isolated world. Checked in Brave on 8 November 2026.
 *
 * The rating is read from the aria-pressed attribute of the buttons, which
 * follows every click. The data.isToggled property of the same components
 * keeps the state of the page load and misses any later click, so it must
 * not be used.
 *
 * In the Shorts player, everything is read inside the Short that contains
 * #shorts-player, which is the one being played even when the page holds
 * several.
 */
import { Surface } from './surface.js';

const SELECTORS = {
  [Surface.WATCH]: {
    ratingBar: 'ytd-menu-renderer.ytd-watch-metadata segmented-like-dislike-button-view-model',
    player: '#movie_player',
    video: '#movie_player video.video-stream',
  },
  [Surface.SHORTS]: {
    ratingBar: 'reel-action-bar-view-model',
    player: '#shorts-player',
    video: '#shorts-player video.video-stream',
  },
};
const SHORT = 'ytd-reel-video-renderer';
// The like component holds two buttons; the one with aria-pressed is the toggle.
const LIKE_BUTTON = 'like-button-view-model button[aria-pressed]';
const DISLIKE_BUTTON = 'dislike-button-view-model button[aria-pressed]';
// In the Shorts action bar, an extension such as Return YouTube Dislike can
// replace the native dislike component with its own button, a direct child
// wrapper of the bar that also carries aria-pressed.
const REPLACED_SHORTS_DISLIKE_BUTTON = ':scope > div button[aria-pressed]';
// Classes of the player while an ad plays (from Taknok/youtube-auto-like; not
// yet observed in this project).
const AD_CLASSES = ['ad-showing', 'ad-interrupting'];

function ratingBar(doc, surface) {
  const selectors = SELECTORS[surface];
  if (!selectors) return null;
  if (surface === Surface.SHORTS) {
    const short = doc.querySelector(selectors.player)?.closest(SHORT);
    return short?.querySelector(selectors.ratingBar) ?? null;
  }
  return doc.querySelector(selectors.ratingBar);
}

function pressed(button) {
  const value = button?.getAttribute('aria-pressed');
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

export function findLikeButton(doc, surface) {
  return ratingBar(doc, surface)?.querySelector(LIKE_BUTTON) ?? null;
}

/** { liked, disliked }, each null when its button is missing or unreadable. */
export function readRating(doc, surface) {
  const bar = ratingBar(doc, surface);
  let dislike = bar?.querySelector(DISLIKE_BUTTON) ?? null;
  if (!dislike && surface === Surface.SHORTS) {
    dislike = bar?.querySelector(REPLACED_SHORTS_DISLIKE_BUTTON) ?? null;
  }
  return {
    liked: pressed(bar?.querySelector(LIKE_BUTTON)),
    disliked: pressed(dislike),
  };
}

/** { position, duration, adPlaying }, with null values when no video is found. */
export function readPlayback(doc, surface) {
  const selectors = SELECTORS[surface];
  const video = selectors ? doc.querySelector(selectors.video) : null;
  const player = selectors ? doc.querySelector(selectors.player) : null;
  return {
    position: video ? video.currentTime : null,
    duration: video ? video.duration : null,
    adPlaying: player ? AD_CLASSES.some((name) => player.classList.contains(name)) : false,
  };
}
