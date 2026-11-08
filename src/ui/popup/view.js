/**
 * What the popup shows about the video of the current tab, from the status
 * sent by the liker (see content/isolated/status.js) and the settings. Pure:
 * texts come from t, numbers and dates are formatted in lang, and now is
 * passed in.
 *
 * The status card answers "what does the extension do with this video, and
 * why"; the actions offer what would change it: like now or not at all for
 * a video still waiting, and the channel lists for every video of the
 * channel.
 */
import { listOf } from '../../core/channels.js';
import { Reason } from '../../core/eligibility.js';
import { Status } from '../../content/isolated/session.js';
import { initialOf } from '../shared/avatar.js';
import { formatAgo, formatClock, formatDuration, formatNumber } from '../shared/format.js';

export const Action = Object.freeze({
  LIKE_NOW: 'like-now',
  SKIP: 'skip',
  ALWAYS: 'always',
  NEVER: 'never',
  UNLIST_NEVER: 'unlist-never',
});

const REASON_DETAILS = {
  [Reason.ALREADY_LIKED]: 'reasonAlreadyLiked',
  [Reason.ALREADY_DISLIKED]: 'reasonAlreadyDisliked',
  [Reason.SKIPPED_BY_USER]: 'reasonSkippedByUser',
  [Reason.NOT_SUBSCRIBED]: 'reasonNotSubscribed',
  [Reason.NOT_IN_ALWAYS_LIST]: 'reasonNotInAlwaysList',
  [Reason.IN_NEVER_LIST]: 'reasonInNeverList',
  [Reason.SHORTS_OFF]: 'reasonShortsOff',
  [Reason.NORMAL_VIDEOS_OFF]: 'reasonNormalVideosOff',
};

const card = (tone, icon, title, detail = null, progress = null) => ({ tone, icon, title, detail, progress });

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
  // Final statuses first: a video liked before a pause stays shown as liked.
  if (status.status === Status.LIKED) return likedCard(status, t, lang, now);
  if (status.status === Status.CLICK_FAILED) return card('error', 'alert', t('statusFailedTitle'), t('statusFailedDetail'));
  if (status.status === Status.SKIPPED) return reasonCard(status.reason, t);
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

/**
 * The list button for the channel: take it out of "never like", keep it
 * from being liked, or have it always liked, depending on whether its
 * videos are liked under the current settings.
 */
export function channelAction(channel, settings) {
  const list = listOf(settings.lists, channel.id);
  if (list === 'never') return Action.UNLIST_NEVER;
  const liked =
    list === 'always' || settings.likeWhat === 'all' || (settings.likeWhat === 'subscribed' && channel.subscribed === true);
  return liked ? Action.NEVER : Action.ALWAYS;
}

/** The buttons under the status card, in order; none while the extension is paused. */
export function actions(status, settings) {
  if (!settings.enabled) return [];
  const list = [];
  if (status.status === Status.WAITING || status.status === Status.WAITING_AD) list.push(Action.LIKE_NOW, Action.SKIP);
  if (status.channel) list.push(channelAction(status.channel, settings));
  return list;
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
 * no video.
 *
 * @returns {{ channel: object|null, card: object, actions: string[] } | null}
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
  return { channel, card: statusCard(status, settings, t, lang, now), actions: actions(status, settings) };
}
