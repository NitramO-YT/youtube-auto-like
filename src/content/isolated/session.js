/**
 * The like decision for one video, one observation at a time.
 *
 * step is pure: the liker passes it what it has just read from the page and
 * carries out the action it returns, so every rule of the like cycle is
 * tested without a browser. A video gets at most one click; once a final
 * status is reached, nothing more happens until the next video.
 *
 * Only a rating the user gave is final (SKIPPED): it is never undone. Every
 * other reason not to like (not subscribed, channel list, Shorts or videos
 * switched off, extension disabled) keeps being checked (NOT_ELIGIBLE), so
 * that subscribing during the video, or changing a setting, takes effect on
 * the video being watched. The subscription state is read live: it follows a
 * subscription made after the page loaded (checked in Brave on both surfaces).
 *
 * An unreadable page is waited for without a time limit: YouTube renders the
 * buttons of a Short only once the user moves the mouse over the page, which
 * may happen long after the Short started.
 *
 * A video is clicked only once it has been ready to like (readable, unrated,
 * at the like time, no ad) on observations at least STABLE_FOR_MS apart: on a
 * liked Short opened in the watch page, the like button was seen "not
 * pressed" for a moment while the page loaded, and a single observation
 * cannot tell such a moment from the real state.
 */
import { evaluateEligibility, Reason } from '../../core/eligibility.js';
import { likeTime } from '../../core/like-time.js';

// How long a click has to show on the button (aria-pressed="true").
export const CLICK_CONFIRM_TIMEOUT_MS = 5_000;
// How long a video must stay ready to like before the click.
export const STABLE_FOR_MS = 1_000;

export const Status = Object.freeze({
  READING: 'reading',
  WAITING: 'waiting',
  WAITING_AD: 'waiting-ad',
  CONFIRMING: 'confirming',
  LIKED: 'liked',
  NOT_ELIGIBLE: 'not-eligible',
  SKIPPED: 'skipped',
  CLICK_FAILED: 'click-failed',
});

const USER_RATINGS = new Set([Reason.ALREADY_LIKED, Reason.ALREADY_DISLIKED]);

const FINAL_STATUSES = new Set([Status.LIKED, Status.SKIPPED, Status.CLICK_FAILED]);

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
    readySince: null,
    clickedAt: null,
    likedAt: null,
    likeNow: false,
    target: null,
    status: Status.READING,
    reason: null,
  };
}

const update = (session, changes, action = null) => ({ session: { ...session, ...changes }, action });

/**
 * "Like now", from the popup: the video no longer waits for its like time.
 * Every other check still applies, the stability delay included.
 */
export function likeNow(session) {
  return isFinal(session) ? session : { ...session, likeNow: true };
}

/**
 * "Not this video", from the popup: the video being watched is left alone
 * for good. A click already made cannot be taken back, so it is refused
 * while the like is being confirmed.
 */
export function skipVideo(session) {
  if (isFinal(session) || session.status === Status.CONFIRMING) return session;
  return { ...session, status: Status.SKIPPED, reason: Reason.SKIPPED_BY_USER, readySince: null };
}

/**
 * Whether a rating counts as given: true when the page shows the button
 * pressed or YouTube sent the video rated with the page, false when neither,
 * null when unknown. The state at load must be about this video: data left
 * from the previous video gives null.
 *
 * @param {boolean|null} shown aria-pressed of the button, null when the
 *   button is missing.
 * @param {object|null} atLoad { toggled, videoId } from the snapshot.
 * @param {boolean} isLike The like button must be on screen, since it is
 *   the one clicked; a missing dislike button is fine once the state at load
 *   says not disliked (the Shorts player often has none, and without one the
 *   user cannot dislike in the page). A dislike button replaced by another
 *   extension carries no data: what it shows is then enough.
 */
function ratingState(shown, atLoad, videoId, isLike) {
  if (shown === true) return true;
  if (atLoad) {
    if (atLoad.videoId !== videoId || atLoad.toggled === null) return null;
    if (atLoad.toggled) return true;
    if (shown === false) return false;
    return isLike ? null : false;
  }
  if (isLike) return null;
  return shown === false ? false : null;
}

/**
 * @param {object} session
 * @param {object} observation { snapshot (from validateSnapshot, or null),
 *   liked, disliked, position, duration, adPlaying }
 * @param {object} settings From normalizeSettings.
 * @param {number} now Milliseconds.
 * @returns {{ session: object, action: 'click' | null }}
 */
export function step(session, observation, settings, now) {
  if (isFinal(session)) return { session, action: null };

  if (session.status === Status.CONFIRMING) {
    if (observation.liked === true) return update(session, { status: Status.LIKED, likedAt: now });
    if (now - session.clickedAt > CLICK_CONFIRM_TIMEOUT_MS) return update(session, { status: Status.CLICK_FAILED });
    return update(session, {});
  }

  const unreadable = () => update(session, { status: Status.READING, reason: Reason.UNKNOWN_STATE, readySince: null });

  // Clicks once the video has stayed ready for STABLE_FOR_MS; until then, waits.
  const ready = (changes) =>
    session.readySince !== null && now - session.readySince >= STABLE_FOR_MS
      ? update(session, { ...changes, status: Status.CONFIRMING, reason: null, clickedAt: now }, 'click')
      : update(session, { ...changes, status: Status.WAITING, reason: null, readySince: session.readySince ?? now });

  // The URL, the player and the surface showing the rating buttons must all
  // point to the same video: while YouTube switches videos, they briefly
  // disagree.
  const { snapshot } = observation;
  if (!snapshot || snapshot.videoId !== session.videoId || snapshot.surfaceVideoId !== session.videoId) {
    return unreadable();
  }

  const verdict = evaluateEligibility(
    {
      channelId: snapshot.channelId,
      isShort: snapshot.isShort,
      subscribed: snapshot.subscribed,
      liked: ratingState(observation.liked, snapshot.likeAtLoad, session.videoId, true),
      disliked: ratingState(observation.disliked, snapshot.dislikeAtLoad, session.videoId, false),
    },
    settings,
  );
  if (!verdict.eligible) {
    if (verdict.reason === Reason.UNKNOWN_STATE) return unreadable();
    const status = USER_RATINGS.has(verdict.reason) ? Status.SKIPPED : Status.NOT_ELIGIBLE;
    return update(session, { status, reason: verdict.reason, readySince: null });
  }

  if (session.likeNow) return ready({ target: { at: 0, basis: 'like-now' } });
  if (settings.timing.mode === 'instant') return ready({ target: { at: 0, basis: 'instant' } });

  // An ad plays in the same video element: its time and duration are not
  // those of the video.
  if (observation.adPlaying) return update(session, { status: Status.WAITING_AD, reason: null, readySince: null });

  if (typeof snapshot.isLive !== 'boolean' || typeof observation.position !== 'number' || Number.isNaN(observation.position)) {
    return unreadable();
  }

  const liveStart = snapshot.isLive ? (session.liveStart ?? observation.position) : null;
  const target = likeTime(settings, { duration: observation.duration, isLive: snapshot.isLive }, session.random);
  if (!target) return update(session, { status: Status.WAITING, reason: null, liveStart, target: null, readySince: null });

  const position = snapshot.isLive ? observation.position - liveStart : observation.position;
  if (position >= target.at) return ready({ liveStart, target });
  return update(session, { status: Status.WAITING, reason: null, liveStart, target, readySince: null });
}
