import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findLikeButton, readPlayback, readRating } from '../../src/content/youtube/dom.js';
import { Surface } from '../../src/content/youtube/surface.js';
import { element, fakeDocument } from '../helpers/fake-dom.mjs';

const WATCH_BAR = 'ytd-menu-renderer.ytd-watch-metadata segmented-like-dislike-button-view-model';
const SHORTS_BAR = 'reel-action-bar-view-model';
const LIKE = 'like-button-view-model button[aria-pressed]';
const DISLIKE = 'dislike-button-view-model button[aria-pressed]';
const REPLACED_DISLIKE = ':scope > div button[aria-pressed]';

const button = (pressed) => element({ attributes: pressed === null ? {} : { 'aria-pressed': pressed } });

const bar = (buttons) =>
  element({
    children: Object.fromEntries(Object.entries(buttons).map(([selector, pressed]) => [selector, button(pressed)])),
  });

const watchPage = (buttons) => fakeDocument({ [WATCH_BAR]: bar(buttons) });

// A page in the Shorts player: the rating bar is read inside the Short that
// contains #shorts-player.
const shortsPage = (buttons, { playerInShort = true } = {}) => {
  const short = element({ children: { [SHORTS_BAR]: bar(buttons) } });
  const player = element({ ancestors: playerInShort ? { 'ytd-reel-video-renderer': short } : {} });
  return fakeDocument({ '#shorts-player': player, [SHORTS_BAR]: bar({ [LIKE]: 'true', [DISLIKE]: 'true' }) });
};

describe('readRating on the watch page', () => {
  it('reads aria-pressed of both buttons', () => {
    assert.deepEqual(readRating(watchPage({ [LIKE]: 'true', [DISLIKE]: 'false' }), Surface.WATCH), { liked: true, disliked: false });
    assert.deepEqual(readRating(watchPage({ [LIKE]: 'false', [DISLIKE]: 'true' }), Surface.WATCH), { liked: false, disliked: true });
  });

  it('gives null for a missing button or an unexpected value', () => {
    assert.deepEqual(readRating(fakeDocument(), Surface.WATCH), { liked: null, disliked: null });
    assert.deepEqual(readRating(watchPage({ [LIKE]: 'mixed', [DISLIKE]: 'false' }), Surface.WATCH), { liked: null, disliked: false });
  });

  it('does not look for a replaced dislike button outside the Shorts player', () => {
    assert.deepEqual(readRating(watchPage({ [LIKE]: 'false', [REPLACED_DISLIKE]: 'false' }), Surface.WATCH), {
      liked: false,
      disliked: null,
    });
  });
});

describe('readRating in the Shorts player', () => {
  it('reads the buttons of the Short that holds the player, not those of another Short', () => {
    assert.deepEqual(readRating(shortsPage({ [LIKE]: 'false', [DISLIKE]: 'false' }), Surface.SHORTS), {
      liked: false,
      disliked: false,
    });
  });

  it('falls back on a dislike button that replaced the native one', () => {
    assert.deepEqual(readRating(shortsPage({ [LIKE]: 'false', [REPLACED_DISLIKE]: 'true' }), Surface.SHORTS), {
      liked: false,
      disliked: true,
    });
  });

  it('prefers the native dislike button when both are present', () => {
    assert.equal(readRating(shortsPage({ [LIKE]: 'false', [DISLIKE]: 'false', [REPLACED_DISLIKE]: 'true' }), Surface.SHORTS).disliked, false);
  });

  it('gives null when the player is in no Short', () => {
    assert.deepEqual(readRating(shortsPage({ [LIKE]: 'false', [DISLIKE]: 'false' }, { playerInShort: false }), Surface.SHORTS), {
      liked: null,
      disliked: null,
    });
  });
});

describe('findLikeButton', () => {
  it('finds the like button of each surface', () => {
    const watch = watchPage({ [LIKE]: 'false', [DISLIKE]: 'false' });
    assert.equal(findLikeButton(watch, Surface.WATCH), watch.querySelector(WATCH_BAR).querySelector(LIKE));
    const shorts = shortsPage({ [LIKE]: 'false', [DISLIKE]: 'false' });
    const expected = shorts.querySelector('#shorts-player').closest('ytd-reel-video-renderer').querySelector(SHORTS_BAR).querySelector(LIKE);
    assert.equal(findLikeButton(shorts, Surface.SHORTS), expected);
  });

  it('finds nothing without a surface or a rating bar', () => {
    assert.equal(findLikeButton(fakeDocument(), Surface.WATCH), null);
    assert.equal(findLikeButton(watchPage({ [LIKE]: 'false' }), null), null);
  });
});

describe('readPlayback', () => {
  const page = (playerSelector, classes) =>
    fakeDocument({
      [playerSelector]: element({ classes }),
      [`${playerSelector} video.video-stream`]: element({ props: { currentTime: 42.5, duration: 1125.121 } }),
    });

  it('reads the position and the duration of the video of each surface', () => {
    assert.deepEqual(readPlayback(page('#movie_player', ['playing-mode']), Surface.WATCH), { position: 42.5, duration: 1125.121, adPlaying: false });
    assert.deepEqual(readPlayback(page('#shorts-player', []), Surface.SHORTS), { position: 42.5, duration: 1125.121, adPlaying: false });
  });

  it('reads the video of the surface shown, not the hidden one of the other surface', () => {
    assert.deepEqual(readPlayback(page('#movie_player', []), Surface.SHORTS), { position: null, duration: null, adPlaying: false });
  });

  it('detects an ad from the classes of the player', () => {
    assert.equal(readPlayback(page('#movie_player', ['ad-showing']), Surface.WATCH).adPlaying, true);
    assert.equal(readPlayback(page('#shorts-player', ['ad-interrupting']), Surface.SHORTS).adPlaying, true);
  });

  it('gives null values when there is no video', () => {
    assert.deepEqual(readPlayback(fakeDocument(), Surface.WATCH), { position: null, duration: null, adPlaying: false });
  });
});
