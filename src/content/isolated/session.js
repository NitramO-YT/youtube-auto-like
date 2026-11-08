/**
 * The like decision for one video, one observation at a time.
 *
 * step is pure: the liker passes it what it has just read from the page and
 * carries out the action it returns, so every rule of the like cycle is
 * tested without a browser. A video gets at most one click; once a final
 * status is reached, nothing more happens until the next video.
 */
import { evaluateEligibility, Reason } from '../../core/eligibility.js';
import { likeTime } from '../../core/like-time.js';

// How long the page may stay unreadable before the liker gives up on a video.
export const UNKNOWN_STATE_TIMEOUT_MS = 30_000;
// How long a click has to show on the button (aria-pressed="true").
export const CLICK_CONFIRM_TIMEOUT_MS = 5_000;

export const Status = Object.freeze({
  READING: 'reading',
  WAITING: 'waiting',
  WAITING_AD: 'waiting-ad',
  CONFIRMING: 'confirming',
  LIKED: 'liked',
  SKIPPED: 'skipped',
  CLICK_FAILED: 'click-failed',
  GAVE_UP: 'gave-up',
});

const FINAL_STATUSES = new Set([Status.LIKED, Status.SKIPPED, Status.CLICK_FAILED, Status.GAVE_UP]);

export const isFinal = (session) => FINAL_STATUSES.has(session.status);

/**
 * @param {string} videoId
 * @param {number} now Milliseconds.
 * @param {number} random Number in [0, 1), drawn once per video for the
 *   random timing.
 */
export function createSession(videoId, now, random) {
  return {
    videoId,
    startedAt: now,
    random,
    liveStart: null,
    clickedAt: null,
    target: null,
    status: Status.READING,
    reason: null,
  };
}

const update = (session, changes, action = null) => ({ session: { ...session, ...changes }, action });

/**
 * @param {object} session
 * @param {object} observation { snapshot (from validateSnapshot, or null),
 *   pageVideoId, liked, disliked, position, duration, adPlaying }
 * @param {object} settings From normalizeSettings.
 * @param {number} now Milliseconds.
 * @returns {{ session: object, action: 'click' | null }}
 */
export function step(session, observation, settings, now) {
  if (isFinal(session)) return { session, action: null };

  if (session.status === Status.CONFIRMING) {
    if (observation.liked === true) return update(session, { status: Status.LIKED });
    if (now - session.clickedAt > CLICK_CONFIRM_TIMEOUT_MS) return update(session, { status: Status.CLICK_FAILED });
    return update(session, {});
  }

  const unreadable = () =>
    now - session.startedAt > UNKNOWN_STATE_TIMEOUT_MS
      ? update(session, { status: Status.GAVE_UP, reason: Reason.UNKNOWN_STATE })
      : update(session, { status: Status.READING, reason: Reason.UNKNOWN_STATE });

  // The URL, the player and the watch page must all show the same video:
  // while YouTube switches videos, they briefly disagree.
  const { snapshot } = observation;
  if (!snapshot || snapshot.videoId !== session.videoId || observation.pageVideoId !== session.videoId) {
    return unreadable();
  }

  const verdict = evaluateEligibility(
    {
      channelId: snapshot.channelId,
      isShort: snapshot.isShort,
      subscribed: snapshot.subscribed,
      liked: observation.liked,
      disliked: observation.disliked,
    },
    settings,
  );
  if (!verdict.eligible) {
    return verdict.reason === Reason.UNKNOWN_STATE
      ? unreadable()
      : update(session, { status: Status.SKIPPED, reason: verdict.reason });
  }

  if (settings.timing.mode === 'instant') {
    return update(
      session,
      { status: Status.CONFIRMING, reason: null, clickedAt: now, target: { at: 0, basis: 'instant' } },
      'click',
    );
  }

  // An ad plays in the same video element: its time and duration are not
  // those of the video.
  if (observation.adPlaying) return update(session, { status: Status.WAITING_AD, reason: null });

  if (typeof snapshot.isLive !== 'boolean' || typeof observation.position !== 'number' || Number.isNaN(observation.position)) {
    return unreadable();
  }

  const liveStart = snapshot.isLive ? (session.liveStart ?? observation.position) : null;
  const target = likeTime(settings, { duration: observation.duration, isLive: snapshot.isLive }, session.random);
  if (!target) return update(session, { status: Status.WAITING, reason: null, liveStart, target: null });

  const position = snapshot.isLive ? observation.position - liveStart : observation.position;
  if (position >= target.at) {
    return update(session, { status: Status.CONFIRMING, reason: null, clickedAt: now, liveStart, target }, 'click');
  }
  return update(session, { status: Status.WAITING, reason: null, liveStart, target });
}
