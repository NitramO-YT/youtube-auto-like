/**
 * Messages between the parts of the extension, through runtime messaging:
 * from the popup to the liker of a YouTube tab (status, like now, skip), and
 * from the extension pages to the background (check for a new version now).
 * Each receiver answers only messages sent by this extension, and only these
 * types.
 */

export const Message = Object.freeze({
  GET_STATUS: 'get-status',
  LIKE_NOW: 'like-now',
  SKIP_VIDEO: 'skip-video',
  CHECK_UPDATES: 'check-updates',
});

const TYPES = new Set(Object.values(Message));

/** The message type, when the message comes from this extension and is known; otherwise null. */
export function acceptedMessage(message, sender, extensionId) {
  if (!sender || sender.id !== extensionId) return null;
  if (!message || typeof message !== 'object' || !TYPES.has(message.type)) return null;
  return message.type;
}
