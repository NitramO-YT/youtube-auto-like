import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { END_MARGIN_SECONDS, likeTime } from '../../src/core/like-time.js';
import { normalizeSettings } from '../../src/core/settings.js';

const timing = (mode, { percent, minutes } = {}) =>
  normalizeSettings({
    timing: {
      mode,
      percent: { enabled: percent !== undefined, value: percent ?? 50 },
      minutes: { enabled: minutes !== undefined, value: minutes ?? 2 },
    },
  });

// The 18 min 45 s COLAS video used for the checks in Brave.
const VIDEO = { duration: 1125, isLive: false };

describe('likeTime', () => {
  it('likes at once in instant mode, even before the duration is known', () => {
    assert.deepEqual(likeTime(timing('instant'), { duration: Number.NaN, isLive: false }), { at: 0, basis: 'instant' });
  });

  describe('custom mode', () => {
    it('waits for the percentage of the duration', () => {
      assert.deepEqual(likeTime(timing('custom', { percent: 50 }), VIDEO), { at: 562.5, basis: 'percent' });
    });

    it('waits for the number of minutes', () => {
      assert.deepEqual(likeTime(timing('custom', { minutes: 2 }), VIDEO), { at: 120, basis: 'minutes' });
    });

    it('takes the earliest threshold when both are enabled', () => {
      assert.deepEqual(likeTime(timing('custom', { percent: 50, minutes: 2 }), VIDEO), { at: 120, basis: 'minutes' });
      assert.deepEqual(likeTime(timing('custom', { percent: 5, minutes: 2 }), VIDEO), { at: 56.25, basis: 'percent' });
    });

    it('moves a threshold past the end to just before the end', () => {
      const short = { duration: 30, isLive: false };
      assert.deepEqual(likeTime(timing('custom', { minutes: 2 }), short), {
        at: 30 - END_MARGIN_SECONDS,
        basis: 'before-end',
      });
      assert.deepEqual(likeTime(timing('custom', { percent: 100 }), short), {
        at: 30 - END_MARGIN_SECONDS,
        basis: 'before-end',
      });
    });

    it('never returns a negative time for a video shorter than the margin', () => {
      assert.deepEqual(likeTime(timing('custom', { minutes: 2 }), { duration: 1, isLive: false }), {
        at: 0,
        basis: 'before-end',
      });
    });

    it('returns null while the duration of a video is unknown', () => {
      for (const duration of [Number.NaN, 0, -1, Number.POSITIVE_INFINITY, undefined]) {
        assert.equal(likeTime(timing('custom', { percent: 50 }), { duration, isLive: false }), null);
      }
    });
  });

  describe('random mode', () => {
    it('draws a whole percentage from 0 to 99', () => {
      assert.deepEqual(likeTime(timing('random'), { duration: 1000, isLive: false }, 0), { at: 0, basis: 'random' });
      assert.deepEqual(likeTime(timing('random'), { duration: 1000, isLive: false }, 0.426), { at: 420, basis: 'random' });
      assert.deepEqual(likeTime(timing('random'), { duration: 1000, isLive: false }, 0.9999), { at: 990, basis: 'random' });
    });

    it('ignores the percentage and minutes thresholds', () => {
      const settings = timing('random', { percent: 5, minutes: 1 });
      assert.deepEqual(likeTime(settings, { duration: 1000, isLive: false }, 0.5), { at: 500, basis: 'random' });
    });
  });

  describe('live streams', () => {
    const LIVE = { duration: Number.POSITIVE_INFINITY, isLive: true };

    it('counts a minutes threshold from the start of watching', () => {
      assert.deepEqual(likeTime(timing('custom', { percent: 50, minutes: 3 }), LIVE), { at: 180, basis: 'minutes' });
    });

    it('likes at once when only a percentage or a random time is set', () => {
      assert.deepEqual(likeTime(timing('custom', { percent: 50 }), LIVE), { at: 0, basis: 'instant' });
      assert.deepEqual(likeTime(timing('random'), LIVE, 0.5), { at: 0, basis: 'instant' });
    });
  });
});
