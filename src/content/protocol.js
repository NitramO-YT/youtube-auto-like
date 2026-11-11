/**
 * Messages between the page reader (MAIN world) and the liker (isolated
 * world), carried by window.postMessage.
 *
 * Any script of the page, YouTube's or another extension's, can read and
 * send these messages. The liker therefore treats every incoming payload as
 * untrusted: validateSnapshot keeps only the expected fields, with their
 * expected type and size, and anything else makes the snapshot unusable.
 */
import { storedAvatarUrl } from '../core/avatar.js';
import { isValidChannelId } from '../core/channels.js';
import { isValidVideoId } from '../core/video.js';

export { isValidVideoId };

export const PAGE_SOURCE = 'youtube-auto-like:page';
export const ISOLATED_SOURCE = 'youtube-auto-like:isolated';
export const SNAPSHOT_REQUEST = 'snapshot-request';
export const SNAPSHOT = 'snapshot';
// The channel a channel page shows (see youtube/channel-page.js).
export const CHANNEL_PAGE_REQUEST = 'channel-page-request';
export const CHANNEL_PAGE = 'channel-page';

const MAX_NAME_LENGTH = 200;
// YouTube limits a title to 100 characters; the margin keeps a title intact
// if that limit grows.
const MAX_TITLE_LENGTH = 300;

const textOf = (value, maxLength) => (typeof value === 'string' ? value.slice(0, maxLength) : '');

const booleanOrNull = (value) => (typeof value === 'boolean' ? value : null);

function validateRatingAtLoad(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    toggled: booleanOrNull(value.toggled),
    videoId: isValidVideoId(value.videoId) ? value.videoId : null,
  };
}

/**
 * @returns {object|null} { videoId, surfaceVideoId, title, channelId,
 *   channelName, avatarUrl, isShort, isLive, subscribed, likeAtLoad,
 *   dislikeAtLoad }. avatarUrl is null unless it is an address
 *   storedAvatarUrl accepts. videoId is the
 *   video of the player, surfaceVideoId the one the rating buttons on screen
 *   belong to; likeAtLoad and dislikeAtLoad are { toggled, videoId }, the
 *   state of each button at page load and the video it rates. Each field the
 *   page did not provide is null; the whole snapshot is null when the payload
 *   has no valid videoId.
 */
export function validateSnapshot(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (!isValidVideoId(payload.videoId)) return null;
  return {
    videoId: payload.videoId,
    surfaceVideoId: isValidVideoId(payload.surfaceVideoId) ? payload.surfaceVideoId : null,
    title: textOf(payload.title, MAX_TITLE_LENGTH),
    channelId: isValidChannelId(payload.channelId) ? payload.channelId : null,
    channelName: textOf(payload.channelName, MAX_NAME_LENGTH),
    avatarUrl: storedAvatarUrl(payload.avatarUrl),
    isShort: booleanOrNull(payload.isShort),
    isLive: booleanOrNull(payload.isLive),
    subscribed: booleanOrNull(payload.subscribed),
    likeAtLoad: validateRatingAtLoad(payload.likeAtLoad),
    dislikeAtLoad: validateRatingAtLoad(payload.dislikeAtLoad),
  };
}

/**
 * @returns {object|null} { id, name, avatarUrl } of the channel a channel
 *   page shows, in the shape of the channels of the lists; null when the
 *   payload has no valid channel ID. avatarUrl is null unless it is an
 *   address storedAvatarUrl accepts.
 */
export function validateChannelPage(payload) {
  if (!payload || typeof payload !== 'object' || !isValidChannelId(payload.channelId)) return null;
  return {
    id: payload.channelId,
    name: textOf(payload.channelName, MAX_NAME_LENGTH),
    avatarUrl: storedAvatarUrl(payload.avatarUrl),
  };
}
