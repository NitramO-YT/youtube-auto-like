/**
 * YouTube video IDs: 11 base64url characters.
 */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function isValidVideoId(id) {
  return typeof id === 'string' && VIDEO_ID_PATTERN.test(id);
}
