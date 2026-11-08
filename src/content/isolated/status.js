/**
 * What the popup shows about the video being watched, built from the
 * liker's session and its last observation of the page. The list the channel
 * is in is not part of it: the popup reads it from its own copy of the
 * settings, which it updates as soon as the user moves the channel.
 */
import { evaluateVideo } from './session.js';

/**
 * @param {object} session From session.js.
 * @param {object|null} observation The last observation, with avatarUrl.
 * @param {object} settings From normalizeSettings.
 * @returns {object} { videoId, title, isShort, isLive, channel, status, reason,
 *   target, elapsed, duration, likedAt, startedAt, rating, ifEnabled }.
 *   channel is null until the page has given a channel ID; elapsed is the
 *   playback position, or the time watched for a live stream; rating is
 *   { liked, disliked } as the buttons show them, or null while the page is
 *   unreadable. ifEnabled, only while the extension is paused, is the
 *   verdict it would give if it were active ({ eligible, reason }, or null
 *   while the page is unreadable).
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
    title: readable ? snapshot.title : '',
    isShort: readable ? snapshot.isShort : null,
    isLive,
    channel: channelId
      ? {
          id: channelId,
          name: snapshot.channelName,
          avatarUrl: observation.avatarUrl ?? null,
          subscribed: snapshot.subscribed,
        }
      : null,
    status: session.status,
    reason: session.reason,
    target: session.target,
    elapsed,
    duration: typeof observation?.duration === 'number' && Number.isFinite(observation.duration) ? observation.duration : null,
    likedAt: session.likedAt,
    startedAt: session.startedAt,
    // What the buttons show now, for a like or a dislike the user removed.
    rating: readable ? { liked: observation.liked ?? null, disliked: observation.disliked ?? null } : null,
    ifEnabled: settings.enabled ? null : evaluateVideo(session, observation, { ...settings, enabled: true }),
  };
}
