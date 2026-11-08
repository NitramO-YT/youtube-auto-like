import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ListFullError } from '../../src/core/channels.js';
import { isVideoExcluded, MAX_EXCLUDED_VIDEOS, mergeExcludedVideos, normalizeExcludedVideos, placeVideo } from '../../src/core/excluded-videos.js';

const NOW = '2026-11-08T21:00:00.000Z';
const video = (videoId, overrides = {}) => ({ videoId, title: `Title of ${videoId}`, channelName: 'COLAS', isShort: false, addedAt: NOW, ...overrides });
const id = (n) => `video${String(n).padStart(6, '0')}`;

describe('placeVideo', () => {
  it('excludes a video, first in the list, and takes it out again', () => {
    const excluded = placeVideo([video('aeP4eG-gO10')], video('EkDC9elBHHc', { isShort: true }), true);
    assert.deepEqual(excluded.map((entry) => entry.videoId), ['EkDC9elBHHc', 'aeP4eG-gO10']);
    assert.ok(isVideoExcluded(excluded, 'EkDC9elBHHc'));
    assert.deepEqual(placeVideo(excluded, { videoId: 'EkDC9elBHHc' }, false).map((entry) => entry.videoId), ['aeP4eG-gO10']);
  });

  it('keeps the place and the date of a video already excluded', () => {
    const videos = [video('aeP4eG-gO10'), video('EkDC9elBHHc')];
    assert.equal(placeVideo(videos, video('EkDC9elBHHc', { addedAt: '2026-12-01T00:00:00.000Z' }), true), videos);
  });

  it('refuses an invalid video and a full list', () => {
    assert.throws(() => placeVideo([], video('nope'), true), /Invalid video ID/);
    const full = Array.from({ length: MAX_EXCLUDED_VIDEOS }, (_, n) => video(id(n)));
    assert.throws(() => placeVideo(full, video('aeP4eG-gO10'), true), ListFullError);
  });
});

describe('mergeExcludedVideos', () => {
  it('adds the imported videos in their order, with their dates, and counts only the new ones', () => {
    const current = [video('aeP4eG-gO10')];
    const imported = [video('EkDC9elBHHc', { addedAt: '2026-01-01T00:00:00.000Z' }), video('aeP4eG-gO10', { title: 'other' }), video('zYHv6J4AH8k')];
    const { videos, added } = mergeExcludedVideos(current, imported);
    assert.equal(added, 2);
    assert.deepEqual(videos.map((entry) => entry.videoId), ['EkDC9elBHHc', 'zYHv6J4AH8k', 'aeP4eG-gO10']);
    assert.equal(videos[0].addedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(videos[2].title, 'Title of aeP4eG-gO10', 'a video already excluded stays as it is');
  });
});

describe('normalizeExcludedVideos', () => {
  it('keeps valid entries with known fields and bounded texts, one per video', () => {
    const videos = normalizeExcludedVideos([
      { ...video('aeP4eG-gO10'), title: 'x'.repeat(1000), script: '<img>' },
      video('aeP4eG-gO10', { title: 'again' }),
      { videoId: 'bad' },
      'text',
    ]);
    assert.equal(videos.length, 1);
    assert.equal(videos[0].title.length, 300);
    assert.equal('script' in videos[0], false);
    assert.deepEqual(normalizeExcludedVideos('videos'), []);
  });
});
