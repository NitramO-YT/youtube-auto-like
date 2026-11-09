/**
 * What the popup shows about the video of the current tab, from the status
 * sent by the liker (see content/isolated/status.js) and the settings. Pure:
 * texts come from t, numbers and dates are formatted in lang, and now is
 * passed in.
 *
 * The status card answers "what does the extension do with this video, and
 * why"; the actions offer what would change it for this video: like now or
 * not at all while it waits. The channel choice puts every video of the
 * channel in a list, or leaves it to the settings.
 */
import { listOf } from '../../core/channels.js';
import { Reason } from '../../core/eligibility.js';
import { Status } from '../../content/isolated/session.js';
import { initialOf } from '../shared/avatar.js';
import { formatAgo, formatClock, formatDuration, formatNumber } from '../shared/format.js';

export const Action = Object.freeze({
  LIKE_NOW: 'like-now',
  // Not this time: the video is left alone for this viewing only.
  SKIP: 'skip',
  // Takes back "not this time", for as long as the video stays open.
  RESUME: 'resume',
  // Never this video, until the user takes it out of the excluded videos.
  EXCLUDE_VIDEO: 'exclude-video',
  UNEXCLUDE_VIDEO: 'unexclude-video',
  // The video goes through the checks again from the start, as after a
  // reload of the page: RESTART for a rating removed or a page read too
  // long, RETRY after a like that did not take.
  RESTART: 'restart',
  RETRY: 'retry',
});

/**
 * Positions of the channel choice: in "always like", in neither list (the
 * settings decide), or in "never like". The values of the two lists are
 * their names in the settings; AUTO stands for no list.
 */
export const ChannelChoice = Object.freeze({ ALWAYS: 'always', AUTO: 'auto', NEVER: 'never' });
export const CHANNEL_CHOICES = Object.freeze([ChannelChoice.ALWAYS, ChannelChoice.AUTO, ChannelChoice.NEVER]);

/** The list a choice puts the channel in, null for AUTO. */
export function listForChoice(choice) {
  return choice === ChannelChoice.AUTO ? null : choice;
}

const REASON_DETAILS = {
  [Reason.ALREADY_LIKED]: 'reasonAlreadyLiked',
  [Reason.ALREADY_DISLIKED]: 'reasonAlreadyDisliked',
  [Reason.SKIPPED_BY_USER]: 'reasonSkippedByUser',
  [Reason.NOT_SUBSCRIBED]: 'reasonNotSubscribed',
  [Reason.NOT_IN_ALWAYS_LIST]: 'reasonNotInAlwaysList',
  [Reason.IN_NEVER_LIST]: 'reasonInNeverList',
  [Reason.SHORTS_OFF]: 'reasonShortsOff',
  [Reason.NORMAL_VIDEOS_OFF]: 'reasonNormalVideosOff',
  [Reason.VIDEO_EXCLUDED]: 'reasonVideoExcluded',
};

// Reading the page for longer than this offers to restart the video.
export const STUCK_READING_MS = 20_000;

const card = (tone, icon, title, detail = null, progress = null) => ({ tone, icon, title, detail, progress });

// A like (by the extension or by the user) or a dislike that the buttons no
// longer show.
const likeRemoved = (status) =>
  status.rating?.liked === false &&
  (status.status === Status.LIKED || (status.status === Status.SKIPPED && status.reason === Reason.ALREADY_LIKED));
const dislikeRemoved = (status) =>
  status.rating?.disliked === false && status.status === Status.SKIPPED && status.reason === Reason.ALREADY_DISLIKED;

/** A like removed that comes back later: when playback passes the like time again, or at the next opening. */
function likeComingBackCard(status, t) {
  const { target } = status;
  const when = !target || target.at === 0 ? t('likeRemovedNextOpening') : t('likeRemovedAt', [formatClock(target.at)]);
  return card('no', 'block', t('removedLikeTitle'), when);
}

function readingCard(t) {
  return card('wait', 'clock', t('statusReading'), t('statusReadingDetail'));
}

function reasonCard(reason, t) {
  const detail = REASON_DETAILS[reason] ? t(REASON_DETAILS[reason]) : null;
  if (reason === Reason.ALREADY_LIKED) return card('liked', 'check', t('statusAlreadyLikedTitle'), detail);
  return card('no', 'block', t('statusNotLikedTitle'), detail);
}

function likedCard(status, t, lang, now) {
  const { target } = status;
  const when = typeof status.likedAt === 'number' ? formatAgo(now - status.likedAt, lang) : null;
  let how = null;
  if (target?.basis === 'instant') how = t('likedHowInstant');
  else if (target?.basis === 'like-now') how = t('likedHowLikeNow');
  else if (target && status.isLive) how = t('likedHowAfterWatching', [formatDuration(target.at, t)]);
  else if (target) how = t('likedHowAt', [formatClock(target.at)]);
  const detail = when && how ? t('statusLikedDetail', [when, how]) : (when ?? how);
  return card('liked', 'check', t('statusLikedTitle'), detail);
}

function waitingTitle(target, settings, t, lang) {
  switch (target.basis) {
    case 'percent':
      return t('statusWaitPercent', [formatNumber(settings.timing.percent.value, lang)]);
    case 'minutes':
      return t('statusWaitMinutes', [formatNumber(settings.timing.minutes.value, lang)]);
    case 'random':
      return t('statusWaitRandom');
    case 'before-end':
      return t('statusWaitBeforeEnd');
    default:
      return t('statusWaitSoon');
  }
}

function waitingCard(status, settings, t, lang) {
  const { target, elapsed } = status;
  if (!target) return card('wait', 'clock', t('statusWaitDuration'));
  const remaining = typeof elapsed === 'number' ? target.at - elapsed : null;
  // Instant likes, "like now", and a like time already reached wait only for
  // the stability delay of the liker, about a second.
  if (target.at <= 0 || (remaining !== null && remaining <= 0)) return card('wait', 'clock', t('statusWaitSoon'));
  return card(
    'wait',
    'clock',
    waitingTitle(target, settings, t, lang),
    remaining === null ? null : t('statusWaitRemaining', [formatDuration(remaining, t)]),
    remaining === null ? null : Math.min(1, Math.max(0, elapsed / target.at)),
  );
}

function pausedCard(status, t) {
  const verdict = status.ifEnabled;
  if (!verdict || verdict.reason === Reason.UNKNOWN_STATE) return readingCard(t);
  if (verdict.eligible) return card('no', 'pause', t('statusWouldLike'), t('statusWouldLikeDetail'));
  return reasonCard(verdict.reason, t);
}

/** The status card: { tone, icon, title, detail, progress }. */
export function statusCard(status, settings, t, lang, now) {
  // Final statuses first: a video liked before a pause stays shown as liked,
  // unless the user removed the like since.
  if (likeRemoved(status)) return card('no', 'block', t('removedLikeTitle'), t('removedLikeRestart'));
  if (dislikeRemoved(status)) return card('no', 'block', t('removedDislikeTitle'), t('removedDislikeRestart'));
  if (status.status === Status.LIKED) return likedCard(status, t, lang, now);
  if (status.status === Status.CLICK_FAILED) return card('error', 'alert', t('statusFailedTitle'), t('statusFailedDetail'));
  if (status.status === Status.SKIPPED) return reasonCard(status.reason, t);
  if (status.reason === Reason.LIKE_REMOVED && settings.enabled) return likeComingBackCard(status, t);
  if (!settings.enabled) return pausedCard(status, t);

  switch (status.status) {
    case Status.WAITING:
      return waitingCard(status, settings, t, lang);
    case Status.WAITING_AD:
      return card('wait', 'clock', t('statusWaitAd'), t('statusWaitAdDetail'));
    case Status.CONFIRMING:
      return card('wait', 'clock', t('statusConfirming'));
    case Status.NOT_ELIGIBLE:
      return reasonCard(status.reason, t);
    default:
      return readingCard(t);
  }
}

/** The position of the channel choice: the list the channel is in, or AUTO. */
export function channelChoice(channel, settings) {
  return listOf(settings.lists, channel.id) ?? ChannelChoice.AUTO;
}

/**
 * The buttons for the video itself: like now, not this time or never while
 * it waits; take back "not this time", like now or never, once skipped this
 * time; no longer excluded, once excluded; restart, once a rating is removed
 * or the page has been read for too long; try again, after a like that did
 * not take.
 */
function videoActions(status, now) {
  if (likeRemoved(status) || dislikeRemoved(status)) return [Action.RESTART];
  if (status.status === Status.CLICK_FAILED) return [Action.RETRY];
  if (status.status === Status.WAITING || status.status === Status.WAITING_AD) {
    return [Action.LIKE_NOW, Action.SKIP, Action.EXCLUDE_VIDEO];
  }
  if (status.reason === Reason.SKIPPED_BY_USER) return [Action.RESUME, Action.LIKE_NOW, Action.EXCLUDE_VIDEO];
  if (status.reason === Reason.VIDEO_EXCLUDED) return [Action.UNEXCLUDE_VIDEO];
  if (status.reason === Reason.LIKE_REMOVED) return [Action.LIKE_NOW];
  if (status.status === Status.READING && typeof status.startedAt === 'number' && now - status.startedAt > STUCK_READING_MS) {
    return [Action.RESTART];
  }
  return [];
}

/** The buttons under the status card, in order; none while the extension is paused. */
export function actions(status, settings, now = Date.now()) {
  return settings.enabled ? videoActions(status, now) : [];
}

/** The line under the channel name: "Subscribed · 18:45 video". */
function channelMeta(status, t) {
  const parts = [];
  if (status.channel.subscribed === true) parts.push(t('channelSubscribed'));
  if (status.channel.subscribed === false) parts.push(t('channelNotSubscribed'));
  if (status.isLive) parts.push(t('kindLive'));
  else if (status.isShort) parts.push(t('kindShort'));
  else if (status.isShort === false) {
    parts.push(typeof status.duration === 'number' ? t('kindVideoDuration', [formatClock(status.duration)]) : t('kindVideo'));
  }
  return parts.join(' · ');
}

/**
 * Everything the popup shows about the video, or null when the tab shows
 * no video. The channel choice (null without a channel) shows even while
 * the extension is paused: it is a setting, not an action on the video.
 *
 * @returns {{ title: string|null, channel: object|null, choice: string|null, card: object, actions: string[] } | null}
 */
export function videoView(status, settings, t, lang, now) {
  if (!status?.videoId) return null;
  const channel = status.channel
    ? {
        id: status.channel.id,
        name: status.channel.name || t('channelUnknown'),
        initial: initialOf(status.channel.name),
        avatarUrl: status.channel.avatarUrl ?? null,
        meta: channelMeta(status, t),
      }
    : null;
  return {
    title: status.title || null,
    channel,
    choice: status.channel ? channelChoice(status.channel, settings) : null,
    card: statusCard(status, settings, t, lang, now),
    actions: actions(status, settings, now),
  };
}
