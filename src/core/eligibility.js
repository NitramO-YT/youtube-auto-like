/**
 * Whether the video being watched should be liked, and if not, why. The
 * reason codes let the popup tell the user what the extension does with the
 * video in front of them.
 *
 * Order of the rules: no account signed in on YouTube stops everything, as
 * a like is then impossible; a rating the user gave wins over the rest; then a
 * video the user excluded for good; then the Shorts and normal video
 * switches; then the "never like" list; then the "always like" list; then
 * the base rule (subscribed channels, every channel, or the "always like"
 * list only).
 */
import { isChannelListed, isValidChannelId } from './channels.js';
import { isVideoExcluded } from './excluded-videos.js';

export const Reason = Object.freeze({
  ELIGIBLE: 'eligible',
  DISABLED: 'disabled',
  // No account is signed in on YouTube: its like button only offers to sign in.
  SIGNED_OUT: 'signed-out',
  UNKNOWN_STATE: 'unknown-state',
  ALREADY_LIKED: 'already-liked',
  ALREADY_DISLIKED: 'already-disliked',
  SHORTS_OFF: 'shorts-off',
  NORMAL_VIDEOS_OFF: 'normal-videos-off',
  NOT_SUBSCRIBED: 'not-subscribed',
  IN_NEVER_LIST: 'in-never-list',
  NOT_IN_ALWAYS_LIST: 'not-in-always-list',
  VIDEO_EXCLUDED: 'video-excluded',
  // Set by the liker, not by evaluateEligibility: the user asked, from the
  // popup, not to like the video being watched.
  SKIPPED_BY_USER: 'skipped-by-user',
  // Set by the liker: the user removed a like, which comes back only once
  // playback crosses the like time again (see session.js).
  LIKE_REMOVED: 'like-removed',
});

const verdict = (eligible, reason) => ({ eligible, reason });
const unknown = verdict(false, Reason.UNKNOWN_STATE);
const eligible = verdict(true, Reason.ELIGIBLE);

/**
 * @param {object} video State read from the page: videoId and channelId
 *   (strings), signedIn, isShort, subscribed, liked and disliked (booleans).
 *   A field the page did not provide is null.
 * @param {object} settings Settings returned by normalizeSettings.
 */
export function evaluateEligibility(video, settings) {
  if (!settings.enabled) return verdict(false, Reason.DISABLED);
  // Only a page that says so: an unknown session goes on with the rules.
  if (video.signedIn === false) return verdict(false, Reason.SIGNED_OUT);

  // A field that could not be read means the page was not understood: doing
  // nothing is safer than liking, or removing a like, on a guess.
  if (typeof video.liked !== 'boolean' || typeof video.disliked !== 'boolean') return unknown;
  if (video.liked) return verdict(false, Reason.ALREADY_LIKED);
  if (video.disliked) return verdict(false, Reason.ALREADY_DISLIKED);
  if (isVideoExcluded(settings.excludedVideos, video.videoId)) return verdict(false, Reason.VIDEO_EXCLUDED);

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
