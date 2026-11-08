/**
 * Messages between the page reader (MAIN world) and the liker (isolated
 * world), carried by window.postMessage.
 *
 * Any script of the page, YouTube's or another extension's, can read and
 * send these messages. The liker therefore treats every incoming payload as
 * untrusted: validateSnapshot keeps only the expected fields, with their
 * expected type and size, and anything else makes the snapshot unusable.
 */
import { isValidChannelId } from '../core/channels.js';

export const PAGE_SOURCE = 'youtube-auto-like:page';
export const ISOLATED_SOURCE = 'youtube-auto-like:isolated';
export const SNAPSHOT_REQUEST = 'snapshot-request';
export const SNAPSHOT = 'snapshot';

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const MAX_NAME_LENGTH = 200;

export function isValidVideoId(id) {
  return typeof id === 'string' && VIDEO_ID_PATTERN.test(id);
}

const booleanOrNull = (value) => (typeof value === 'boolean' ? value : null);

/**
 * @returns {object|null} { videoId, surfaceVideoId, channelId, channelName,
 *   isShort, isLive, subscribed }. videoId is the video of the player,
 *   surfaceVideoId the one the rating buttons on screen belong to. Each field
 *   the page did not provide is null; the whole snapshot is null when the
 *   payload has no valid videoId.
 */
export function validateSnapshot(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (!isValidVideoId(payload.videoId)) return null;
  return {
    videoId: payload.videoId,
    surfaceVideoId: isValidVideoId(payload.surfaceVideoId) ? payload.surfaceVideoId : null,
    channelId: isValidChannelId(payload.channelId) ? payload.channelId : null,
    channelName: typeof payload.channelName === 'string' ? payload.channelName.slice(0, MAX_NAME_LENGTH) : '',
    isShort: booleanOrNull(payload.isShort),
    isLive: booleanOrNull(payload.isLive),
    subscribed: booleanOrNull(payload.subscribed),
  };
}
