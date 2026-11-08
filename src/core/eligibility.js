/**
 * Whether the video being watched should be liked, and if not, why. The
 * reason codes let the popup tell the user what the extension does with the
 * video in front of them.
 *
 * The list rules (allowlist or blocklist, combined with likeWhat by "and" or
 * "or") follow Taknok/youtube-auto-like.
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
  NOT_IN_ALLOWLIST: 'not-in-allowlist',
  IN_BLOCKLIST: 'in-blocklist',
});

const verdict = (eligible, reason) => ({ eligible, reason });
const unknown = verdict(false, Reason.UNKNOWN_STATE);

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

  let audienceOk = true;
  if (settings.likeWhat === 'subscribed') {
    if (typeof video.subscribed !== 'boolean') return unknown;
    audienceOk = video.subscribed;
  }
  if (!settings.list.enabled) {
    return audienceOk ? verdict(true, Reason.ELIGIBLE) : verdict(false, Reason.NOT_SUBSCRIBED);
  }

  if (!isValidChannelId(video.channelId)) return unknown;
  const isAllowlist = settings.list.mode === 'allowlist';
  const listed = isChannelListed(settings.channels, video.channelId);
  const listOk = isAllowlist ? listed : !listed;
  const listReason = isAllowlist ? Reason.NOT_IN_ALLOWLIST : Reason.IN_BLOCKLIST;

  if (settings.list.combine === 'or') {
    // Either condition is enough; when both fail, the list is the rule the
    // user set explicitly, so it is the one reported.
    return audienceOk || listOk ? verdict(true, Reason.ELIGIBLE) : verdict(false, listReason);
  }
  if (!audienceOk) return verdict(false, Reason.NOT_SUBSCRIBED);
  return listOk ? verdict(true, Reason.ELIGIBLE) : verdict(false, listReason);
}
