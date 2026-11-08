/**
 * What the popup shows about the video being watched, built from the
 * liker's session and its last observation of the page.
 */
import { listOf } from '../../core/channels.js';

/**
 * @param {object} session From session.js.
 * @param {object|null} observation The last observation, with avatarUrl.
 * @param {object} settings From normalizeSettings.
 * @returns {object} { videoId, isShort, isLive, channel, status, reason,
 *   target, elapsed, duration, likedAt }. channel is null until the page has
 *   given a channel ID; elapsed is the playback position, or the time watched
 *   for a live stream.
 */
export function popupStatus(session, observation, settings) {
  const snapshot = observation?.snapshot ?? null;
  const readable = snapshot?.videoId === session.videoId;
  const channelId = readable ? snapshot.channelId : null;
  const position = typeof observation?.position === 'number' && !Number.isNaN(observation.position) ? observation.position : null;
  const isLive = readable ? snapshot.isLive : null;
  const elapsed = position === null ? null : isLive && session.liveStart !== null ? position - session.liveStart : position;

  return {
    videoId: session.videoId,
    isShort: readable ? snapshot.isShort : null,
    isLive,
    channel: channelId
      ? {
          id: channelId,
          name: snapshot.channelName,
          avatarUrl: observation.avatarUrl ?? null,
          subscribed: snapshot.subscribed,
          list: listOf(settings.lists, channelId),
        }
      : null,
    status: session.status,
    reason: session.reason,
    target: session.target,
    elapsed,
    duration: typeof observation?.duration === 'number' && Number.isFinite(observation.duration) ? observation.duration : null,
    likedAt: session.likedAt,
  };
}
