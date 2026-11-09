/**
 * The user's two channel lists: "always like" and "never like". Channels are
 * identified by their channel ID, which never changes, unlike their name or
 * handle; the name and the avatar address are kept for display only. Each
 * entry is { id, name, avatarUrl, addedAt }. A channel is in one list at
 * most.
 */
import { storedAvatarUrl } from './avatar.js';

// "UC" followed by 22 base64url characters.
const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;
export const MAX_NAME_LENGTH = 200;
export const MAX_CHANNELS = 5000;
export const LIST_NAMES = ['always', 'never'];

/** Thrown when an entry would go past the maximum size of a list. */
export class ListFullError extends Error {
  constructor(list, max = MAX_CHANNELS) {
    super(`The ${list} list is full (${max} entries).`);
    this.name = 'ListFullError';
    this.list = list;
    this.max = max;
  }
}

export function isValidChannelId(id) {
  return typeof id === 'string' && CHANNEL_ID_PATTERN.test(id);
}

function validDate(value) {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value)) ? value : null;
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
    channels.push({ id: entry.id, name, avatarUrl: storedAvatarUrl(entry.avatarUrl), addedAt: validDate(entry.addedAt) });
  }
  return channels;
}

/**
 * Both lists, each normalized; a channel found in both is kept in "never",
 * the list that wins anyway.
 */
export function normalizeLists(raw) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const never = normalizeChannels(input.never);
  const neverIds = new Set(never.map((channel) => channel.id));
  const always = normalizeChannels(input.always).filter((channel) => !neverIds.has(channel.id));
  return { always, never };
}

export function isChannelListed(channels, channelId) {
  return channels.some((channel) => channel.id === channelId);
}

/** The list a channel is in, 'always' or 'never', or null. */
export function listOf(lists, channelId) {
  return LIST_NAMES.find((name) => isChannelListed(lists[name], channelId)) ?? null;
}

/**
 * Moves a channel to a list, or out of both with target null. Returns new
 * lists; the inputs are not modified. A channel already in the target list
 * keeps its place and its addedAt; its name and its avatar are refreshed
 * when the channel given has them. Throws ListFullError when the target
 * list is full.
 *
 * @param {object} lists { always, never }
 * @param {object} channel { id, name, avatarUrl? }
 * @param {'always'|'never'|null} target
 * @param {string} now ISO date of the change, kept as addedAt.
 */
export function placeChannel(lists, channel, target, now) {
  if (!isValidChannelId(channel?.id)) throw new Error(`Invalid channel ID: ${channel?.id}`);
  if (target !== null && !LIST_NAMES.includes(target)) throw new Error(`Unknown list: ${target}`);
  const [entry] = normalizeChannels([{ id: channel.id, name: channel.name, avatarUrl: channel.avatarUrl, addedAt: now }]);
  const without = (list) => list.filter((existing) => existing.id !== channel.id);
  const next = { always: without(lists.always), never: without(lists.never) };
  if (target === null) return next;

  if (isChannelListed(lists[target], channel.id)) {
    next[target] = lists[target].map((existing) =>
      existing.id === channel.id
        ? { ...existing, name: entry.name || existing.name, avatarUrl: entry.avatarUrl ?? existing.avatarUrl ?? null }
        : existing,
    );
    return next;
  }
  if (next[target].length >= MAX_CHANNELS) throw new ListFullError(target);
  next[target] = [entry, ...next[target]];
  return next;
}
