/**
 * The avatar of a channel wherever the extension keeps one: the entries of
 * the two lists (avatarUrl), the excluded videos and the history
 * (channelAvatarUrl). An entry can lack it, when the page did not show it at
 * the moment the entry was made, and an address can change when the channel
 * changes its picture: the latest address read for the channel, on a YouTube
 * page or from the channel page, goes to every entry of that channel.
 */
import { storedAvatarUrl } from './avatar.js';
import { isValidChannelId, LIST_NAMES } from './channels.js';

/**
 * { entries, count }: the entries with the avatar of a channel set, and how
 * many changed; the same array when none does.
 */
function withAvatar(entries, channelId, avatarUrl, idKey, urlKey) {
  let count = 0;
  const next = entries.map((entry) => {
    if (entry[idKey] !== channelId || entry[urlKey] === avatarUrl) return entry;
    count += 1;
    return { ...entry, [urlKey]: avatarUrl };
  });
  return { entries: count > 0 ? next : entries, count };
}

/**
 * Settings and history with the avatar of a channel set in every entry of
 * that channel. The inputs are not modified; each part that does not change
 * is returned as is, so that a caller writes only what changed.
 *
 * @param {object} settings Normalized settings (lists, excludedVideos).
 * @param {object[]} history Normalized history.
 * @param {string} channelId
 * @param {string} avatarUrl An address storedAvatarUrl accepts; anything else changes nothing.
 * @returns {{ settings: object, history: object[], count: number }} count: entries changed.
 */
export function setChannelAvatar(settings, history, channelId, avatarUrl) {
  const url = storedAvatarUrl(avatarUrl);
  if (!url || !isValidChannelId(channelId)) return { settings, history, count: 0 };
  let count = 0;
  const update = (entries, idKey, urlKey) => {
    const result = withAvatar(entries, channelId, url, idKey, urlKey);
    count += result.count;
    return result.entries;
  };
  const lists = Object.fromEntries(LIST_NAMES.map((name) => [name, update(settings.lists[name], 'id', 'avatarUrl')]));
  const excludedVideos = update(settings.excludedVideos, 'channelId', 'channelAvatarUrl');
  const nextHistory = update(history, 'channelId', 'channelAvatarUrl');
  const listsChanged = LIST_NAMES.some((name) => lists[name] !== settings.lists[name]);
  const nextSettings =
    listsChanged || excludedVideos !== settings.excludedVideos
      ? { ...settings, lists: listsChanged ? lists : settings.lists, excludedVideos }
      : settings;
  return { settings: nextSettings, history: nextHistory, count };
}

/**
 * The channels with at least one entry without an avatar, each once: those
 * of the history first, newest first, then of the lists and of the excluded
 * videos. An entry without a channel ID is left out.
 */
export function channelsWithoutAvatar(settings, history) {
  const ids = new Set();
  const collect = (entries, idKey, urlKey) => {
    for (const entry of entries) {
      if (!entry[urlKey] && isValidChannelId(entry[idKey])) ids.add(entry[idKey]);
    }
  };
  collect(history, 'channelId', 'channelAvatarUrl');
  for (const name of LIST_NAMES) collect(settings.lists[name], 'id', 'avatarUrl');
  collect(settings.excludedVideos, 'channelId', 'channelAvatarUrl');
  return [...ids];
}
