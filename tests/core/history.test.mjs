import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addToHistory, historyEntry, MAX_HISTORY, normalizeHistory, videoUrl } from '../../src/core/history.js';

const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const like = (videoId, overrides = {}) => ({
  videoId,
  title: `Title of ${videoId}`,
  channelId: COLAS,
  channelName: 'COLAS',
  isShort: false,
  likedAt: '2026-11-08T21:00:00.000Z',
  ...overrides,
});
const id = (n) => `video${String(n).padStart(6, '0')}`;

describe('addToHistory', () => {
  it('puts the new like on top', () => {
    const history = addToHistory([like('aeP4eG-gO10')], like('EkDC9elBHHc', { isShort: true }));
    assert.deepEqual(history.map((entry) => entry.videoId), ['EkDC9elBHHc', 'aeP4eG-gO10']);
  });

  it('moves a video liked again to the top instead of showing it twice', () => {
    const history = addToHistory([like('aeP4eG-gO10'), like('EkDC9elBHHc')], like('EkDC9elBHHc', { likedAt: '2026-11-09T08:00:00.000Z' }));
    assert.deepEqual(history.map((entry) => [entry.videoId, entry.likedAt]), [
      ['EkDC9elBHHc', '2026-11-09T08:00:00.000Z'],
      ['aeP4eG-gO10', '2026-11-08T21:00:00.000Z'],
    ]);
  });

  it('keeps the last MAX_HISTORY likes', () => {
    const full = Array.from({ length: MAX_HISTORY }, (_, n) => like(id(n)));
    const history = addToHistory(full, like('aeP4eG-gO10'));
    assert.equal(history.length, MAX_HISTORY);
    assert.equal(history[0].videoId, 'aeP4eG-gO10');
    assert.equal(history.at(-1).videoId, id(MAX_HISTORY - 2));
  });

  it('leaves the history as it is for an invalid like', () => {
    const history = [like('aeP4eG-gO10')];
    assert.equal(addToHistory(history, like('not an id')), history);
    assert.equal(addToHistory(history, like('EkDC9elBHHc', { likedAt: 'yesterday' })), history);
  });
});

describe('normalizeHistory', () => {
  it('keeps valid entries with known fields and bounded texts', () => {
    const [entry] = normalizeHistory([{ ...like('aeP4eG-gO10'), title: 'x'.repeat(1000), script: '<img>', channelId: '@COLAS.' }]);
    assert.equal(entry.title.length, 300);
    assert.equal(entry.channelId, null);
    assert.equal('script' in entry, false);
  });

  it('drops invalid entries and duplicates, and anything that is not a list', () => {
    assert.deepEqual(normalizeHistory('history'), []);
    const history = normalizeHistory([like('aeP4eG-gO10'), null, like('bad'), like('aeP4eG-gO10', { title: 'again' }), 'text']);
    assert.deepEqual(history.map((entry) => entry.title), ['Title of aeP4eG-gO10']);
  });
});

describe('historyEntry', () => {
  it('describes the like from the snapshot taken at the click', () => {
    const snapshot = { title: 'le moooonstre', channelId: COLAS, channelName: 'COLAS', isShort: true };
    assert.deepEqual(historyEntry('EkDC9elBHHc', snapshot, Date.parse('2026-11-08T21:00:00.000Z')), {
      videoId: 'EkDC9elBHHc',
      title: 'le moooonstre',
      channelId: COLAS,
      channelName: 'COLAS',
      isShort: true,
      likedAt: '2026-11-08T21:00:00.000Z',
    });
  });

  it('keeps the video and the date without a snapshot', () => {
    const entry = historyEntry('EkDC9elBHHc', null, Date.parse('2026-11-08T21:00:00.000Z'));
    assert.deepEqual(addToHistory([], entry).map((e) => [e.videoId, e.title, e.channelId]), [['EkDC9elBHHc', '', null]]);
  });
});

describe('videoUrl', () => {
  it('opens a video in the player it was liked in', () => {
    assert.equal(videoUrl(like('aeP4eG-gO10')), 'https://www.youtube.com/watch?v=aeP4eG-gO10');
    assert.equal(videoUrl(like('EkDC9elBHHc', { isShort: true })), 'https://www.youtube.com/shorts/EkDC9elBHHc');
  });
});
