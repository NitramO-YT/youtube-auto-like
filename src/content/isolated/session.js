/**
 * The like decision for one video, one observation at a time.
 *
 * step is pure: the liker passes it what it has just read from the page and
 * carries out the action it returns, so every rule of the like cycle is
 * tested without a browser. A video gets at most one click; once a final
 * status is reached, nothing more happens until the next video.
 *
 * Only a rating the user gave is final (SKIPPED). Every other reason not to
 * like (not subscribed, channel list, Shorts or videos switched off,
 * extension disabled) keeps being checked (NOT_ELIGIBLE), so that
 * subscribing during the video, or changing a setting, takes effect on the
 * video being watched. The subscription state is read live: it follows a
 * subscription made after the page loaded (checked in Brave on both surfaces).
 *
 * A final video keeps being watched, never clicked: the popup shows a like
 * or a dislike the user removes, and offers to restart the video. With the
 * relikeAfterRemoval setting, a like removed comes back once playback
 * crosses the like time again (see watchRemovedLike).
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
import { isVideoExcluded } from '../../core/excluded-videos.js';
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
    // Rating read from the buttons only, not from the state sent with the
    // page: set once the user has changed the rating since the page loaded.
    trustShown: false,
    // A like the user removed comes back only once playback has gone back
    // before the like time and reaches it again.
    mustCross: false,
    // Since when the like has been seen removed, for the stability delay.
    removedSince: null,
  };
}

/**
 * "Restart for this video", from the popup: the video goes through the
 * checks again from the start, as after a reload of the page, the rating
 * being read from what the buttons show.
 */
export function restartVideo(session, now, random) {
  return { ...createSession(session.videoId, now, random), trustShown: true };
}

const update = (session, changes, action = null) => ({ session: { ...session, ...changes }, action });

const skippedThisTime = (session) => session.status === Status.SKIPPED && session.reason === Reason.SKIPPED_BY_USER;

/**
 * Back from "not this time", from the popup: the video goes through the
 * checks again, as if it had just opened. Only a video skipped this way
 * comes back; a rating the user gave stays final.
 */
export function resumeVideo(session) {
  if (!skippedThisTime(session)) return session;
  return { ...session, status: Status.READING, reason: null, readySince: null };
}

/**
 * "Like now", from the popup: the video no longer waits for its like time,
 * and a video skipped this time comes back. Every other check still applies,
 * the stability delay included.
 */
export function likeNow(session) {
  const resumed = resumeVideo(session);
  return isFinal(resumed) ? resumed : { ...resumed, likeNow: true };
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
 * @param {boolean} trustShown The rating changed since the page loaded: a
 *   button shown not pressed is believed over the state sent with the page.
 */
function ratingState(shown, atLoad, videoId, isLike, trustShown) {
  if (shown === true) return true;
  if (trustShown && shown === false) return false;
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
 * Whether the video of the session should be liked, from one observation:
 * the verdict of evaluateEligibility, or null when the page does not show
 * this video yet. The URL, the player and the surface showing the rating
 * buttons must all point to the same video: while YouTube switches videos,
 * they briefly disagree.
 *
 * @param {object} session
 * @param {object|null} observation As for step.
 * @param {object} settings From normalizeSettings.
 */
const showsVideo = (session, snapshot) =>
  Boolean(snapshot) && snapshot.videoId === session.videoId && snapshot.surfaceVideoId === session.videoId;

export function evaluateVideo(session, observation, settings) {
  const snapshot = observation?.snapshot;
  if (!showsVideo(session, snapshot)) return null;
  return evaluateEligibility(
    {
      videoId: session.videoId,
      channelId: snapshot.channelId,
      signedIn: snapshot.signedIn,
      guestIds: (snapshot.guests ?? []).map((guest) => guest.id),
      isShort: snapshot.isShort,
      subscribed: snapshot.subscribed,
      liked: likeState(session, observation),
      disliked: ratingState(observation.disliked, snapshot.dislikeAtLoad, session.videoId, false, session.trustShown),
    },
    settings,
  );
}

/**
 * Whether the video of the session is liked, read as for the decision to
 * like it (see ratingState): true, false, or null when unknown or when the
 * page does not show this video yet.
 */
export function likeState(session, observation) {
  const snapshot = observation?.snapshot;
  if (!showsVideo(session, snapshot)) return null;
  return ratingState(observation.liked, snapshot.likeAtLoad, session.videoId, true, session.trustShown);
}

/**
 * A liked video, by the extension or by the user, whose like the user
 * removes. With relikeAfterRemoval, once the like has stayed removed for
 * STABLE_FOR_MS, the video goes through the checks again, and must see
 * playback cross its like time again (mustCross); otherwise it stays as it
 * is, and the popup offers to restart it.
 */
function watchRemovedLike(session, observation, settings, now) {
  const liked = session.status === Status.LIKED || (session.status === Status.SKIPPED && session.reason === Reason.ALREADY_LIKED);
  if (!liked || !settings.enabled || !settings.relikeAfterRemoval) return { session, action: null };
  const removed = showsVideo(session, observation.snapshot) && observation.liked === false && observation.disliked !== true;
  if (!removed) return session.removedSince === null ? { session, action: null } : update(session, { removedSince: null });
  if (session.removedSince === null) return update(session, { removedSince: now });
  if (now - session.removedSince < STABLE_FOR_MS) return { session, action: null };
  return update(session, {
    status: Status.READING,
    reason: null,
    readySince: null,
    clickedAt: null,
    likeNow: false,
    target: null,
    removedSince: null,
    trustShown: true,
    mustCross: true,
  });
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
  // Excluding for good a video skipped this time: the exclusion wins, and
  // the video is shown as excluded.
  if (skippedThisTime(session) && isVideoExcluded(settings.excludedVideos, session.videoId)) {
    return update(session, { status: Status.NOT_ELIGIBLE, reason: Reason.VIDEO_EXCLUDED, readySince: null });
  }
  if (isFinal(session)) return watchRemovedLike(session, observation, settings, now);

  if (session.status === Status.CONFIRMING) {
    if (observation.liked === true) return update(session, { status: Status.LIKED, likedAt: now });
    if (now - session.clickedAt > CLICK_CONFIRM_TIMEOUT_MS) return update(session, { status: Status.CLICK_FAILED });
    return update(session, {});
  }

  const unreadable = () => update(session, { status: Status.READING, reason: Reason.UNKNOWN_STATE, readySince: null });

  // Clicks once the video has stayed ready for STABLE_FOR_MS; until then, waits.
  const ready = (changes) =>
    session.readySince !== null && now - session.readySince >= STABLE_FOR_MS
      ? update(session, { ...changes, status: Status.CONFIRMING, reason: null, clickedAt: now, mustCross: false }, 'click')
      : update(session, { ...changes, status: Status.WAITING, reason: null, readySince: session.readySince ?? now });
  // A like the user removed, waiting for playback to cross the like time again.
  const removedLike = (changes) => update(session, { ...changes, status: Status.NOT_ELIGIBLE, reason: Reason.LIKE_REMOVED, readySince: null });

  const verdict = evaluateVideo(session, observation, settings);
  if (!verdict) return unreadable();
  const { snapshot } = observation;
  if (!verdict.eligible) {
    if (verdict.reason === Reason.UNKNOWN_STATE) return unreadable();
    const status = USER_RATINGS.has(verdict.reason) ? Status.SKIPPED : Status.NOT_ELIGIBLE;
    return update(session, { status, reason: verdict.reason, readySince: null });
  }

  if (session.likeNow) return ready({ target: { at: 0, basis: 'like-now' } });
  if (settings.timing.mode === 'instant') {
    // An instant like has no time to cross again: it comes back the next
    // time the video is opened.
    const target = { at: 0, basis: 'instant' };
    return session.mustCross ? removedLike({ target }) : ready({ target });
  }

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
  if (position >= target.at) return session.mustCross ? removedLike({ liveStart, target }) : ready({ liveStart, target });
  // Before the like time: a like removed may come back once it is reached.
  return update(session, { status: Status.WAITING, reason: null, liveStart, target, readySince: null, mustCross: false });
}
