import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Reason } from '../../src/core/eligibility.js';
import { normalizeSettings } from '../../src/core/settings.js';
import {
  CLICK_CONFIRM_TIMEOUT_MS,
  createSession,
  isFinal,
  Status,
  step,
  UNKNOWN_STATE_TIMEOUT_MS,
} from '../../src/content/isolated/session.js';

const VIDEO_ID = 'aeP4eG-gO10';
const T0 = 1_000_000;

const snapshot = (overrides = {}) => ({
  videoId: VIDEO_ID,
  channelId: 'UC9orcd4I_3Uy_8_UAz2r48g',
  channelName: 'COLAS',
  isShort: false,
  isLive: false,
  subscribed: true,
  ...overrides,
});

const observation = (overrides = {}) => ({
  snapshot: snapshot(),
  pageVideoId: VIDEO_ID,
  liked: false,
  disliked: false,
  position: 0,
  duration: 1125,
  adPlaying: false,
  ...overrides,
});

const instant = normalizeSettings({});
const halfway = normalizeSettings({ timing: { mode: 'custom', percent: { enabled: true, value: 50 } } });
const afterMinutes = (minutes) =>
  normalizeSettings({ timing: { mode: 'custom', percent: { enabled: false }, minutes: { enabled: true, value: minutes } } });

const start = () => createSession(VIDEO_ID, T0, 0.5);

describe('step', () => {
  describe('instant timing', () => {
    it('clicks on the first readable observation, then confirms the like', () => {
      const first = step(start(), observation(), instant, T0);
      assert.equal(first.action, 'click');
      assert.equal(first.session.status, Status.CONFIRMING);

      const confirmed = step(first.session, observation({ liked: true }), instant, T0 + 1000);
      assert.equal(confirmed.action, null);
      assert.equal(confirmed.session.status, Status.LIKED);
      assert.ok(isFinal(confirmed.session));
    });

    it('does not wait for an ad to end', () => {
      assert.equal(step(start(), observation({ adPlaying: true }), instant, T0).action, 'click');
    });
  });

  describe('never clicks twice', () => {
    it('waits for the confirmation without clicking again', () => {
      const clicked = step(start(), observation(), instant, T0).session;
      const pending = step(clicked, observation(), instant, T0 + 1000);
      assert.equal(pending.action, null);
      assert.equal(pending.session.status, Status.CONFIRMING);
    });

    it('gives up when the like does not show after the timeout', () => {
      const clicked = step(start(), observation(), instant, T0).session;
      const failed = step(clicked, observation(), instant, T0 + CLICK_CONFIRM_TIMEOUT_MS + 1);
      assert.equal(failed.session.status, Status.CLICK_FAILED);
      assert.equal(step(failed.session, observation(), instant, T0 + 60_000).action, null);
    });

    it('does nothing more once the video is liked, even if the like is removed', () => {
      const liked = step(step(start(), observation(), instant, T0).session, observation({ liked: true }), instant, T0 + 500);
      assert.equal(step(liked.session, observation({ liked: false }), instant, T0 + 5000).action, null);
    });
  });

  describe('videos it must not like', () => {
    it('skips a video already liked or disliked, with the reason', () => {
      assert.deepEqual(
        [step(start(), observation({ liked: true }), instant, T0), step(start(), observation({ disliked: true }), instant, T0)].map(
          ({ session, action }) => [session.status, session.reason, action],
        ),
        [
          [Status.SKIPPED, Reason.ALREADY_LIKED, null],
          [Status.SKIPPED, Reason.ALREADY_DISLIKED, null],
        ],
      );
    });

    it('skips a channel the user is not subscribed to', () => {
      const result = step(start(), observation({ snapshot: snapshot({ subscribed: false }) }), instant, T0);
      assert.equal(result.session.status, Status.SKIPPED);
      assert.equal(result.session.reason, Reason.NOT_SUBSCRIBED);
    });

    it('stops when the user rates the video during the wait', () => {
      const waiting = step(start(), observation({ position: 10 }), halfway, T0).session;
      const result = step(waiting, observation({ position: 20, liked: true }), halfway, T0 + 10_000);
      assert.equal(result.session.status, Status.SKIPPED);
      assert.equal(result.action, null);
    });
  });

  describe('unreadable page', () => {
    const unreadableCases = {
      'no snapshot': { snapshot: null },
      'player still on the previous video': { snapshot: snapshot({ videoId: 'aaaaaaaaaaa' }) },
      'watch page still on the previous video': { pageVideoId: 'aaaaaaaaaaa' },
      'watch page without video-id': { pageVideoId: null },
      'like state unknown': { liked: null },
      'subscription unknown': { snapshot: snapshot({ subscribed: null }) },
    };
    for (const [label, overrides] of Object.entries(unreadableCases)) {
      it(`keeps reading without clicking: ${label}`, () => {
        const result = step(start(), observation(overrides), instant, T0 + 1000);
        assert.equal(result.action, null);
        assert.equal(result.session.status, Status.READING);
        assert.equal(result.session.reason, Reason.UNKNOWN_STATE);
      });
    }

    it('gives up after the timeout', () => {
      const result = step(start(), observation({ snapshot: null }), instant, T0 + UNKNOWN_STATE_TIMEOUT_MS + 1);
      assert.equal(result.session.status, Status.GAVE_UP);
      assert.ok(isFinal(result.session));
    });

    it('recovers when the page becomes readable in time', () => {
      const reading = step(start(), observation({ snapshot: null }), instant, T0 + 1000).session;
      assert.equal(step(reading, observation(), instant, T0 + 2000).action, 'click');
    });

    // Seen in Brave on 8 November 2026: the reason of the reading phase was
    // still reported once the video was liked.
    it('clears the reason of the reading phase once the page is readable', () => {
      for (const settings of [instant, halfway]) {
        const reading = step(start(), observation({ snapshot: null }), settings, T0 + 1000).session;
        const next = step(reading, observation({ position: 900 }), settings, T0 + 2000).session;
        assert.equal(next.reason, null);
        assert.equal(step(next, observation({ liked: true }), settings, T0 + 3000).session.reason, null);
      }
    });
  });

  describe('delayed timing', () => {
    it('waits until the target position, then clicks', () => {
      const early = step(start(), observation({ position: 100 }), halfway, T0);
      assert.equal(early.action, null);
      assert.equal(early.session.status, Status.WAITING);
      assert.deepEqual(early.session.target, { at: 562.5, basis: 'percent' });

      const due = step(early.session, observation({ position: 562.5 }), halfway, T0 + 1000);
      assert.equal(due.action, 'click');
    });

    it('clicks at once when the user seeks past the target', () => {
      assert.equal(step(start(), observation({ position: 900 }), halfway, T0).action, 'click');
    });

    it('waits while an ad plays, even past the target', () => {
      const result = step(start(), observation({ position: 900, adPlaying: true }), halfway, T0);
      assert.equal(result.action, null);
      assert.equal(result.session.status, Status.WAITING_AD);
    });

    it('waits while the duration is unknown', () => {
      const result = step(start(), observation({ position: 900, duration: Number.NaN }), halfway, T0);
      assert.equal(result.action, null);
      assert.equal(result.session.status, Status.WAITING);
      assert.equal(result.session.target, null);
    });

    it('follows a change of the settings during the wait', () => {
      const waiting = step(start(), observation({ position: 200 }), halfway, T0).session;
      assert.equal(step(waiting, observation({ position: 200 }), afterMinutes(2), T0 + 1000).action, 'click');
    });

    it('counts minutes of a live stream from where the viewer started', () => {
      const live = (position) => observation({ snapshot: snapshot({ isLive: true }), position, duration: Number.POSITIVE_INFINITY });
      const settings = afterMinutes(1);
      const first = step(start(), live(5000), settings, T0);
      assert.equal(first.action, null);
      assert.equal(first.session.liveStart, 5000);
      assert.equal(step(first.session, live(5059), settings, T0 + 59_000).action, null);
      assert.equal(step(first.session, live(5060), settings, T0 + 60_000).action, 'click');
    });
  });
});
