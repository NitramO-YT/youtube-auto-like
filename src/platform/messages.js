/**
 * Messages from the extension's own pages (popup) to the liker of a YouTube
 * tab, through runtime messaging. The liker answers only messages sent by
 * this extension, and only these types.
 */

export const Message = Object.freeze({
  GET_STATUS: 'get-status',
  LIKE_NOW: 'like-now',
  SKIP_VIDEO: 'skip-video',
});

const TYPES = new Set(Object.values(Message));

/** The message type, when the message comes from this extension and is known; otherwise null. */
export function acceptedMessage(message, sender, extensionId) {
  if (!sender || sender.id !== extensionId) return null;
  if (!message || typeof message !== 'object' || !TYPES.has(message.type)) return null;
  return message.type;
}
