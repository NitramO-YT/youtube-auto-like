import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findLikeButton, readPlayback, readRating, videoIdFromUrl, watchPageVideoId } from '../../src/content/youtube/dom.js';
import { element, fakeDocument } from '../helpers/fake-dom.mjs';

const RATING_BAR = 'ytd-menu-renderer.ytd-watch-metadata segmented-like-dislike-button-view-model';
const LIKE = 'like-button-view-model button';
const DISLIKE = 'dislike-button-view-model button';

const ratingPage = (like, dislike) =>
  fakeDocument({
    [RATING_BAR]: element({
      children: {
        ...(like !== undefined && { [LIKE]: element({ attributes: like === null ? {} : { 'aria-pressed': like } }) }),
        ...(dislike !== undefined && { [DISLIKE]: element({ attributes: dislike === null ? {} : { 'aria-pressed': dislike } }) }),
      },
    }),
  });

describe('videoIdFromUrl', () => {
  it('reads watch and Shorts URLs', () => {
    assert.equal(videoIdFromUrl('https://www.youtube.com/watch?v=aeP4eG-gO10'), 'aeP4eG-gO10');
    assert.equal(videoIdFromUrl('https://www.youtube.com/watch?v=rB6_IFAKzec&t=2703s'), 'rB6_IFAKzec');
    assert.equal(videoIdFromUrl('https://www.youtube.com/shorts/JgL5gMtA2X4'), 'JgL5gMtA2X4');
  });

  it('returns null for other pages and for malformed URLs', () => {
    for (const href of [
      'https://www.youtube.com/',
      'https://www.youtube.com/@COLAS./videos',
      'https://www.youtube.com/watch',
      'not a url',
    ]) {
      assert.equal(videoIdFromUrl(href), null, href);
    }
  });
});

describe('readRating', () => {
  it('reads aria-pressed of both buttons', () => {
    assert.deepEqual(readRating(ratingPage('true', 'false')), { liked: true, disliked: false });
    assert.deepEqual(readRating(ratingPage('false', 'true')), { liked: false, disliked: true });
  });

  it('gives null for a missing button, a missing attribute or an unexpected value', () => {
    assert.deepEqual(readRating(fakeDocument()), { liked: null, disliked: null });
    assert.deepEqual(readRating(ratingPage(null, 'mixed')), { liked: null, disliked: null });
    assert.deepEqual(readRating(ratingPage('false')), { liked: false, disliked: null });
  });
});

describe('findLikeButton', () => {
  it('finds the like button in the rating bar of the watch page', () => {
    const page = ratingPage('false', 'false');
    assert.equal(findLikeButton(page), page.querySelector(RATING_BAR).querySelector(LIKE));
    assert.equal(findLikeButton(fakeDocument()), null);
  });
});

describe('watchPageVideoId', () => {
  it('reads the video-id attribute of the watch page', () => {
    const page = fakeDocument({ 'ytd-watch-flexy': element({ attributes: { 'video-id': 'aeP4eG-gO10' } }) });
    assert.equal(watchPageVideoId(page), 'aeP4eG-gO10');
    assert.equal(watchPageVideoId(fakeDocument()), null);
  });
});

describe('readPlayback', () => {
  const page = (classes) =>
    fakeDocument({
      '#movie_player': element({ classes }),
      '#movie_player video.video-stream': element({ props: { currentTime: 42.5, duration: 1125.121 } }),
    });

  it('reads the position and the duration of the video', () => {
    assert.deepEqual(readPlayback(page(['playing-mode'])), { position: 42.5, duration: 1125.121, adPlaying: false });
  });

  it('detects an ad from the classes of the player', () => {
    assert.equal(readPlayback(page(['ad-showing'])).adPlaying, true);
    assert.equal(readPlayback(page(['ad-interrupting'])).adPlaying, true);
  });

  it('gives null values when there is no video', () => {
    assert.deepEqual(readPlayback(fakeDocument()), { position: null, duration: null, adPlaying: false });
  });
});
