/**
 * The user's channel list, used as an allowlist or a blocklist. Channels are
 * identified by their channel ID, which never changes, unlike their name or
 * handle; the name is kept for display only.
 */

// "UC" followed by 22 base64url characters.
const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;
const MAX_NAME_LENGTH = 200;
export const MAX_CHANNELS = 5000;

export function isValidChannelId(id) {
  return typeof id === 'string' && CHANNEL_ID_PATTERN.test(id);
}

/**
 * Keeps the valid entries of a list read from storage or from an import, in
 * their order, without duplicates and within MAX_CHANNELS.
 */
export function normalizeChannels(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const channels = [];
  for (const entry of raw) {
    if (channels.length >= MAX_CHANNELS) break;
    if (!entry || typeof entry !== 'object' || !isValidChannelId(entry.id) || seen.has(entry.id)) {
      continue;
    }
    seen.add(entry.id);
    const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, MAX_NAME_LENGTH) : '';
    channels.push({ id: entry.id, name });
  }
  return channels;
}

export function isChannelListed(channels, channelId) {
  return channels.some((channel) => channel.id === channelId);
}
