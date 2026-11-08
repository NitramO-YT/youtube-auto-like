import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Reason } from '../../src/core/eligibility.js';
import { normalizeSettings } from '../../src/core/settings.js';
import {
  CLICK_CONFIRM_TIMEOUT_MS,
  createSession,
  isFinal,
  likeNow,
  resumeVideo,
  skipVideo,
  STABLE_FOR_MS,
  Status,
  step,
} from '../../src/content/isolated/session.js';

const VIDEO_ID = 'aeP4eG-gO10';
const T0 = 1_000_000;

const snapshot = (overrides = {}) => ({
  videoId: VIDEO_ID,
  surfaceVideoId: VIDEO_ID,
  channelId: 'UC9orcd4I_3Uy_8_UAz2r48g',
  channelName: 'COLAS',
  isShort: false,
  isLive: false,
  subscribed: true,
  likeAtLoad: { toggled: false, videoId: VIDEO_ID },
  dislikeAtLoad: { toggled: false, videoId: VIDEO_ID },
  ...overrides,
});

const observation = (overrides = {}) => ({
  snapshot: snapshot(),
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

/** The same observation at `now` and STABLE_FOR_MS later: the second result. */
const settle = (session, obs, settings, now) => step(step(session, obs, settings, now).session, obs, settings, now + STABLE_FOR_MS);

/** A session that has clicked, at T0 + STABLE_FOR_MS. */
const clicked = () => settle(start(), observation(), instant, T0).session;

describe('step', () => {
  describe('instant timing', () => {
    it('clicks once the video has stayed unrated for STABLE_FOR_MS, then confirms the like', () => {
      const first = step(start(), observation(), instant, T0);
      assert.equal(first.action, null);
      assert.equal(first.session.status, Status.WAITING);

      const second = step(first.session, observation(), instant, T0 + STABLE_FOR_MS);
      assert.equal(second.action, 'click');
      assert.equal(second.session.status, Status.CONFIRMING);

      const confirmed = step(second.session, observation({ liked: true }), instant, T0 + STABLE_FOR_MS + 1000);
      assert.equal(confirmed.action, null);
      assert.equal(confirmed.session.status, Status.LIKED);
      assert.ok(isFinal(confirmed.session));
    });

    it('does not click on observations closer than STABLE_FOR_MS', () => {
      const first = step(start(), observation(), instant, T0);
      assert.equal(step(first.session, observation(), instant, T0 + STABLE_FOR_MS - 1).action, null);
    });

    it('does not wait for an ad to end', () => {
      assert.equal(settle(start(), observation({ adPlaying: true }), instant, T0).action, 'click');
    });
  });

  // Seen in Brave on 8 November 2026: the like button of a liked Short opened
  // in the watch page was read "not pressed" for a moment while it loaded.
  describe('stability before the click', () => {
    it('skips a video whose button turns out pressed right after reading unpressed', () => {
      const first = step(start(), observation(), instant, T0);
      const result = step(first.session, observation({ liked: true }), instant, T0 + 500);
      assert.equal(result.action, null);
      assert.equal(result.session.status, Status.SKIPPED);
      assert.equal(result.session.reason, Reason.ALREADY_LIKED);
    });

    it('starts the wait over after an unreadable observation', () => {
      const first = step(start(), observation(), instant, T0);
      const lost = step(first.session, observation({ snapshot: null }), instant, T0 + 500);
      assert.equal(lost.session.readySince, null);
      const back = step(lost.session, observation(), instant, T0 + STABLE_FOR_MS + 100);
      assert.equal(back.action, null);
      assert.equal(step(back.session, observation(), instant, T0 + 2 * STABLE_FOR_MS + 100).action, 'click');
    });

    it('starts the wait over when an ad starts before the delayed like', () => {
      const due = step(start(), observation({ position: 900 }), halfway, T0);
      const ad = step(due.session, observation({ position: 900, adPlaying: true }), halfway, T0 + 500);
      assert.equal(ad.session.readySince, null);
      assert.equal(step(ad.session, observation({ position: 901 }), halfway, T0 + STABLE_FOR_MS + 100).action, null);
    });
  });

  // The subscription state follows a subscription made after the page loaded
  // (checked in Brave on 8 November 2026, watch page and Shorts player).
  describe('changes during the video', () => {
    const notSubscribed = observation({ snapshot: snapshot({ subscribed: false }) });

    it('likes the video once the user subscribes to the channel during it', () => {
      const before = settle(start(), notSubscribed, instant, T0).session;
      const subscribed = step(before, observation(), instant, T0 + 10_000);
      assert.equal(subscribed.action, null, 'waits for the state to hold');
      assert.equal(step(subscribed.session, observation(), instant, T0 + 10_000 + STABLE_FOR_MS).action, 'click');
    });

    it('does not like after a subscription seen for less than STABLE_FOR_MS', () => {
      const subscribed = step(settle(start(), notSubscribed, instant, T0).session, observation(), instant, T0 + 10_000);
      assert.equal(step(subscribed.session, notSubscribed, instant, T0 + 10_000 + STABLE_FOR_MS).action, null);
    });

    it('likes the video once the extension is enabled again', () => {
      const disabled = settle(start(), observation(), normalizeSettings({ enabled: false }), T0).session;
      assert.equal(disabled.reason, Reason.DISABLED);
      assert.equal(settle(disabled, observation(), instant, T0 + 5000).action, 'click');
    });

    it('keeps a rating given by the user final, whatever changes after', () => {
      const liked = step(start(), observation({ liked: true }), instant, T0).session;
      assert.ok(isFinal(liked));
      assert.equal(settle(liked, observation(), instant, T0 + 5000).action, null);
    });
  });

  describe('videos excluded for good', () => {
    const excluded = normalizeSettings({ excludedVideos: [{ videoId: VIDEO_ID }] });

    it('leaves an excluded video alone, and likes it once taken out of the list', () => {
      const left = settle(start(), observation(), excluded, T0);
      assert.equal(left.action, null);
      assert.equal(left.session.status, Status.NOT_ELIGIBLE);
      assert.equal(left.session.reason, Reason.VIDEO_EXCLUDED);
      const taken = settle(left.session, observation(), instant, T0 + 5000);
      assert.equal(taken.action, 'click');
    });
  });

  describe('commands from the popup', () => {
    it('"like now" skips the wait, but not the stability delay', () => {
      const waiting = step(start(), observation({ position: 10 }), halfway, T0).session;
      const asked = likeNow(waiting);
      const first = step(asked, observation({ position: 11 }), halfway, T0 + 1000);
      assert.equal(first.action, null);
      assert.deepEqual(first.session.target, { at: 0, basis: 'like-now' });
      assert.equal(step(first.session, observation({ position: 12 }), halfway, T0 + 2000).action, 'click');
    });

    it('"like now" never likes a video the user has rated', () => {
      const asked = likeNow(step(start(), observation({ position: 10 }), halfway, T0).session);
      const result = settle(asked, observation({ liked: true }), halfway, T0 + 1000);
      assert.equal(result.action, null);
      assert.equal(result.session.reason, Reason.ALREADY_LIKED);
    });

    it('"like now" changes nothing once the video is done with', () => {
      const liked = step(clicked(), observation({ liked: true }), instant, T0 + 2000).session;
      assert.equal(likeNow(liked), liked);
    });

    it('"not this video" leaves the video alone for good', () => {
      const skipped = skipVideo(step(start(), observation({ position: 10 }), halfway, T0).session);
      assert.equal(skipped.status, Status.SKIPPED);
      assert.equal(skipped.reason, Reason.SKIPPED_BY_USER);
      assert.ok(isFinal(skipped));
      assert.equal(settle(skipped, observation({ position: 900 }), halfway, T0 + 5000).action, null);
    });

    it('"not this time" can be taken back: the video goes through the checks again', () => {
      const skipped = skipVideo(step(start(), observation({ position: 10 }), halfway, T0).session);
      const resumed = resumeVideo(skipped);
      assert.equal(resumed.status, Status.READING);
      assert.equal(resumed.reason, null);
      const waiting = step(resumed, observation({ position: 20 }), halfway, T0 + 5000).session;
      assert.equal(waiting.status, Status.WAITING);
    });

    it('"like now" brings back a video skipped this time, and likes it after the stability delay', () => {
      const skipped = skipVideo(step(start(), observation({ position: 10 }), halfway, T0).session);
      const liked = settle(likeNow(skipped), observation({ position: 20 }), halfway, T0 + 5000);
      assert.equal(liked.action, 'click');
    });

    it('never brings back a video the user rated', () => {
      const rated = settle(start(), observation({ liked: true }), instant, T0).session;
      assert.equal(rated.reason, Reason.ALREADY_LIKED);
      assert.equal(resumeVideo(rated), rated);
      assert.equal(likeNow(rated), rated);
    });

    it('"not this video" cannot take back a click already made', () => {
      const confirming = clicked();
      assert.equal(skipVideo(confirming), confirming);
    });

    it('records when the like was confirmed', () => {
      const liked = step(clicked(), observation({ liked: true }), instant, T0 + 2500).session;
      assert.equal(liked.likedAt, T0 + 2500);
    });
  });

  describe('never clicks twice', () => {
    it('waits for the confirmation without clicking again', () => {
      const pending = step(clicked(), observation(), instant, T0 + 2000);
      assert.equal(pending.action, null);
      assert.equal(pending.session.status, Status.CONFIRMING);
    });

    it('gives up when the like does not show after the timeout', () => {
      const failed = step(clicked(), observation(), instant, T0 + STABLE_FOR_MS + CLICK_CONFIRM_TIMEOUT_MS + 1);
      assert.equal(failed.session.status, Status.CLICK_FAILED);
      assert.equal(step(failed.session, observation(), instant, T0 + 60_000).action, null);
    });

    it('does nothing more once the video is liked, even if the like is removed', () => {
      const liked = step(clicked(), observation({ liked: true }), instant, T0 + 2000);
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

    it('does not like a channel the user is not subscribed to, and keeps watching', () => {
      const result = settle(start(), observation({ snapshot: snapshot({ subscribed: false }) }), instant, T0);
      assert.equal(result.action, null);
      assert.equal(result.session.status, Status.NOT_ELIGIBLE);
      assert.equal(result.session.reason, Reason.NOT_SUBSCRIBED);
      assert.equal(isFinal(result.session), false);
    });

    // Seen in Brave on 8 November 2026, at every load of a liked Short opened
    // in the watch page: the button read "not pressed" while YouTube had sent
    // the video as liked, and the liker clicked.
    it('never clicks a video liked at page load, even while its button shows it unliked', () => {
      const result = settle(start(), observation({ snapshot: snapshot({ likeAtLoad: { toggled: true, videoId: VIDEO_ID } }) }), instant, T0);
      assert.equal(result.action, null);
      assert.equal(result.session.status, Status.SKIPPED);
      assert.equal(result.session.reason, Reason.ALREADY_LIKED);
    });

    it('skips a video disliked at page load', () => {
      const result = step(start(), observation({ snapshot: snapshot({ dislikeAtLoad: { toggled: true, videoId: VIDEO_ID } }) }), instant, T0);
      assert.equal(result.session.reason, Reason.ALREADY_DISLIKED);
    });

    it('leaves alone a video whose like the user removed after the page loaded', () => {
      const result = settle(
        start(),
        observation({ liked: false, snapshot: snapshot({ likeAtLoad: { toggled: true, videoId: VIDEO_ID } }) }),
        instant,
        T0,
      );
      assert.equal(result.action, null);
      assert.equal(result.session.reason, Reason.ALREADY_LIKED);
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
      'surface still showing the previous video': { snapshot: snapshot({ surfaceVideoId: 'aaaaaaaaaaa' }) },
      'surface without a video ID': { snapshot: snapshot({ surfaceVideoId: null }) },
      'like state at load missing': { snapshot: snapshot({ likeAtLoad: null }) },
      'like state at load unknown': { snapshot: snapshot({ likeAtLoad: { toggled: null, videoId: VIDEO_ID } }) },
      'like button still holding the previous video': { snapshot: snapshot({ likeAtLoad: { toggled: false, videoId: 'aaaaaaaaaaa' } }) },
      'dislike button still holding the previous video': {
        snapshot: snapshot({ dislikeAtLoad: { toggled: false, videoId: 'aaaaaaaaaaa' } }),
      },
      'like state unknown': { liked: null },
      'subscription unknown': { snapshot: snapshot({ subscribed: null }) },
    };
    for (const [label, overrides] of Object.entries(unreadableCases)) {
      it(`keeps reading without clicking: ${label}`, () => {
        const result = settle(start(), observation(overrides), instant, T0 + 1000);
        assert.equal(result.action, null);
        assert.equal(result.session.status, Status.READING);
        assert.equal(result.session.reason, Reason.UNKNOWN_STATE);
      });
    }

    // Seen in Brave on 8 November 2026: YouTube renders the buttons of a Short
    // only once the user moves the mouse over the page, possibly long after
    // the Short started.
    it('keeps waiting for as long as the page stays unreadable, then likes', () => {
      let session = start();
      for (const elapsed of [1_000, 30_001, 300_000]) {
        const result = step(session, observation({ liked: null, disliked: null }), instant, T0 + elapsed);
        assert.equal(result.action, null);
        assert.equal(result.session.status, Status.READING);
        assert.equal(isFinal(result.session), false);
        session = result.session;
      }
      assert.equal(settle(session, observation(), instant, T0 + 300_001).action, 'click');
    });

    // Seen in Brave on 8 November 2026: Shorts with no dislike button at all
    // stayed unreadable until Return YouTube Dislike added its own.
    it('likes a video with no dislike button once the state at load says not disliked', () => {
      const result = settle(start(), observation({ disliked: null }), instant, T0);
      assert.equal(result.action, 'click');
    });

    it('skips a video with no dislike button that YouTube sent disliked', () => {
      const result = step(
        start(),
        observation({ disliked: null, snapshot: snapshot({ dislikeAtLoad: { toggled: true, videoId: VIDEO_ID } }) }),
        instant,
        T0,
      );
      assert.equal(result.session.reason, Reason.ALREADY_DISLIKED);
    });

    it('waits when there is neither a dislike button nor a dislike state at load', () => {
      const result = settle(start(), observation({ disliked: null, snapshot: snapshot({ dislikeAtLoad: null }) }), instant, T0);
      assert.equal(result.action, null);
      assert.equal(result.session.reason, Reason.UNKNOWN_STATE);
    });

    it('still needs the like button on screen, whatever the state at load', () => {
      const result = settle(start(), observation({ liked: null }), instant, T0);
      assert.equal(result.action, null);
      assert.equal(result.session.reason, Reason.UNKNOWN_STATE);
    });

    it('accepts a dislike button with no state at load, replaced by another extension', () => {
      assert.equal(settle(start(), observation({ snapshot: snapshot({ dislikeAtLoad: null }) }), instant, T0).action, 'click');
      assert.equal(
        step(start(), observation({ disliked: true, snapshot: snapshot({ dislikeAtLoad: null }) }), instant, T0).session.reason,
        Reason.ALREADY_DISLIKED,
      );
    });

    // Seen in Brave on 8 November 2026: the reason of the reading phase was
    // still reported once the video was liked.
    it('clears the reason of the reading phase once the page is readable', () => {
      for (const settings of [instant, halfway]) {
        const reading = step(start(), observation({ snapshot: null }), settings, T0 + 1000).session;
        const next = settle(reading, observation({ position: 900 }), settings, T0 + 2000).session;
        assert.equal(next.reason, null);
        assert.equal(step(next, observation({ liked: true }), settings, T0 + 4000).session.reason, null);
      }
    });
  });

  describe('delayed timing', () => {
    it('waits until the target position, then clicks once it has held', () => {
      const early = step(start(), observation({ position: 100 }), halfway, T0);
      assert.equal(early.action, null);
      assert.equal(early.session.status, Status.WAITING);
      assert.deepEqual(early.session.target, { at: 562.5, basis: 'percent' });

      const due = step(early.session, observation({ position: 562.5 }), halfway, T0 + 1000);
      assert.equal(due.action, null);
      assert.equal(step(due.session, observation({ position: 563.5 }), halfway, T0 + 2000).action, 'click');
    });

    it('clicks soon after the user seeks past the target', () => {
      assert.equal(settle(start(), observation({ position: 900 }), halfway, T0).action, 'click');
    });

    it('waits while an ad plays, even past the target', () => {
      const result = settle(start(), observation({ position: 900, adPlaying: true }), halfway, T0);
      assert.equal(result.action, null);
      assert.equal(result.session.status, Status.WAITING_AD);
    });

    it('waits while the duration is unknown', () => {
      const result = settle(start(), observation({ position: 900, duration: Number.NaN }), halfway, T0);
      assert.equal(result.action, null);
      assert.equal(result.session.status, Status.WAITING);
      assert.equal(result.session.target, null);
    });

    it('follows a change of the settings during the wait', () => {
      const waiting = step(start(), observation({ position: 200 }), halfway, T0).session;
      assert.equal(settle(waiting, observation({ position: 200 }), afterMinutes(2), T0 + 1000).action, 'click');
    });

    it('counts minutes of a live stream from where the viewer started', () => {
      const live = (position) => observation({ snapshot: snapshot({ isLive: true }), position, duration: Number.POSITIVE_INFINITY });
      const settings = afterMinutes(1);
      const first = step(start(), live(5000), settings, T0);
      assert.equal(first.action, null);
      assert.equal(first.session.liveStart, 5000);
      const before = step(first.session, live(5059), settings, T0 + 59_000);
      assert.equal(before.action, null);
      const due = step(before.session, live(5060), settings, T0 + 60_000);
      assert.equal(due.action, null);
      assert.equal(step(due.session, live(5061), settings, T0 + 61_000).action, 'click');
    });
  });
});
