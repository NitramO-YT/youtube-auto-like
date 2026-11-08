/**
 * YouTube videos: their IDs, 11 base64url characters, and their address.
 */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function isValidVideoId(id) {
  return typeof id === 'string' && VIDEO_ID_PATTERN.test(id);
}

/** Address of a video on YouTube, in its player: the Shorts player for a Short. */
export function videoUrl({ videoId, isShort }) {
  return isShort ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`;
}
