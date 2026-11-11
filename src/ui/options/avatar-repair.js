/**
 * Gives an avatar to the entries saved without one (a like made before the
 * page showed the picture, a channel added by its ID alone), without the
 * user opening the channel: when the options page opens, the channel page
 * of each such channel is asked from YouTube (lookUpChannelById, the lookup
 * of "Add channels", with the browser's YouTube cookies), and the avatar
 * found goes to every entry of the channel (store.refreshChannelAvatar).
 *
 * At most MAX_LOOKUPS channels per opening, one after the other. A channel
 * whose page gives no avatar (deleted, unreachable) is not asked again
 * before RETRY_AFTER_MS, remembered in the localStorage of the extension
 * (TRIED_KEY); without that storage, it is asked again at the next opening.
 */
import { channelsWithoutAvatar } from '../../core/channel-avatars.js';
import { isValidChannelId } from '../../core/channels.js';
import { lookUpChannelById } from './channel-lookup.js';

export const MAX_LOOKUPS = 20;
export const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
export const TRIED_KEY = 'youtube-auto-like:avatar-lookups';

/** The channels tried without success less than RETRY_AFTER_MS ago: { channelId: time }. */
export function recentTries(raw, now) {
  const tries = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return tries;
  for (const [channelId, at] of Object.entries(raw)) {
    if (isValidChannelId(channelId) && Number.isFinite(at) && at <= now && now - at < RETRY_AFTER_MS) tries[channelId] = at;
  }
  return tries;
}

/** The channels to look up now: those without a recent try, at most MAX_LOOKUPS. */
export function channelsToLookUp(channelIds, tries) {
  return channelIds.filter((channelId) => !Object.hasOwn(tries, channelId)).slice(0, MAX_LOOKUPS);
}

function readTries(storage, now) {
  try {
    return recentTries(JSON.parse(storage?.getItem(TRIED_KEY) ?? 'null'), now);
  } catch {
    return {};
  }
}

function writeTries(storage, tries) {
  try {
    storage?.setItem(TRIED_KEY, JSON.stringify(tries));
  } catch {
    // Without the storage, a channel without an avatar is asked again at the next opening.
  }
}

/**
 * Looks up the missing avatars, and saves those found.
 *
 * @param {{ store: object, fetchImpl: Function, storage?: Storage|null, now?: () => number }} options
 * @returns {Promise<number>} The number of channels given an avatar.
 */
export async function repairMissingAvatars({ store, fetchImpl, storage = null, now = Date.now }) {
  const [settings, history] = await Promise.all([store.loadSettings(), store.loadHistory()]);
  const tries = readTries(storage, now());
  let repaired = 0;
  for (const channelId of channelsToLookUp(channelsWithoutAvatar(settings, history), tries)) {
    const { channel } = await lookUpChannelById(channelId, fetchImpl);
    if (channel?.avatarUrl && (await store.refreshChannelAvatar(channelId, channel.avatarUrl)) > 0) {
      repaired += 1;
    } else if (!channel?.avatarUrl) {
      tries[channelId] = now();
    }
  }
  writeTries(storage, tries);
  return repaired;
}
