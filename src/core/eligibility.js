/**
 * Whether the video being watched should be liked, and if not, why. The
 * reason codes let the popup tell the user what the extension does with the
 * video in front of them.
 *
 * Order of the rules: a rating the user gave wins over everything; then the
 * Shorts and normal video switches; then the "never like" list; then the
 * "always like" list; then the base rule (subscribed channels, every channel,
 * or the "always like" list only).
 */
import { isChannelListed, isValidChannelId } from './channels.js';

export const Reason = Object.freeze({
  ELIGIBLE: 'eligible',
  DISABLED: 'disabled',
  UNKNOWN_STATE: 'unknown-state',
  ALREADY_LIKED: 'already-liked',
  ALREADY_DISLIKED: 'already-disliked',
  SHORTS_OFF: 'shorts-off',
  NORMAL_VIDEOS_OFF: 'normal-videos-off',
  NOT_SUBSCRIBED: 'not-subscribed',
  IN_NEVER_LIST: 'in-never-list',
  NOT_IN_ALWAYS_LIST: 'not-in-always-list',
  // Set by the liker, not by evaluateEligibility: the user asked, from the
  // popup, not to like the video being watched.
  SKIPPED_BY_USER: 'skipped-by-user',
});

const verdict = (eligible, reason) => ({ eligible, reason });
const unknown = verdict(false, Reason.UNKNOWN_STATE);
const eligible = verdict(true, Reason.ELIGIBLE);

/**
 * @param {object} video State read from the page: channelId (string),
 *   isShort, subscribed, liked and disliked (booleans). A field the page did
 *   not provide is null.
 * @param {object} settings Settings returned by normalizeSettings.
 */
export function evaluateEligibility(video, settings) {
  if (!settings.enabled) return verdict(false, Reason.DISABLED);

  // A field that could not be read means the page was not understood: doing
  // nothing is safer than liking, or removing a like, on a guess.
  if (typeof video.liked !== 'boolean' || typeof video.disliked !== 'boolean') return unknown;
  if (video.liked) return verdict(false, Reason.ALREADY_LIKED);
  if (video.disliked) return verdict(false, Reason.ALREADY_DISLIKED);

  if (typeof video.isShort !== 'boolean') return unknown;
  if (video.isShort && !settings.likeShorts) return verdict(false, Reason.SHORTS_OFF);
  if (!video.isShort && !settings.likeNormalVideos) return verdict(false, Reason.NORMAL_VIDEOS_OFF);

  const { always, never } = settings.lists;
  const channelMatters = always.length > 0 || never.length > 0 || settings.likeWhat === 'alwaysList';
  if (channelMatters) {
    if (!isValidChannelId(video.channelId)) return unknown;
    if (isChannelListed(never, video.channelId)) return verdict(false, Reason.IN_NEVER_LIST);
    if (isChannelListed(always, video.channelId)) return eligible;
  }

  if (settings.likeWhat === 'all') return eligible;
  if (settings.likeWhat === 'alwaysList') return verdict(false, Reason.NOT_IN_ALWAYS_LIST);
  if (typeof video.subscribed !== 'boolean') return unknown;
  return video.subscribed ? eligible : verdict(false, Reason.NOT_SUBSCRIBED);
}
