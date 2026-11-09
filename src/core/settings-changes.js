/**
 * What a change of the settings changed, as short English lines for the
 * journal of the debug mode (core/journal.js): each setting with its old and
 * new value, each channel added to or removed from a list, each video
 * excluded for good or no longer excluded. Each line is { videoId, text },
 * videoId the video concerned or null.
 */
import { LIST_NAMES } from './channels.js';

// Past this number of channels or videos added, or removed, at once (an
// import, a list replaced), one line gives their number instead of one line
// each: the journal keeps MAX_JOURNAL lines in all.
export const MAX_ITEM_LINES = 5;

// Described item by item instead of as values; the schema version is not a
// choice of the user.
const NOT_VALUES = new Set(['schemaVersion', 'lists', 'excludedVideos']);

/** Each value of the settings under its dotted path: "timing.percent.value" → 50. */
function values(settings) {
  const out = new Map();
  const walk = (value, path) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value)) walk(child, path ? `${path}.${key}` : key);
    } else {
      out.set(path, value);
    }
  };
  for (const [key, value] of Object.entries(settings)) {
    if (!NOT_VALUES.has(key)) walk(value, key);
  }
  return out;
}

function valueLines(before, after) {
  const old = values(before);
  const lines = [];
  for (const [path, value] of values(after)) {
    if (!Object.is(old.get(path), value)) lines.push({ videoId: null, text: `setting ${path}: ${old.get(path)} -> ${value}` });
  }
  return lines;
}

/** The items of after missing from before, by key. */
function missing(from, items, keyOf) {
  const keys = new Set(from.map(keyOf));
  return items.filter((item) => !keys.has(keyOf(item)));
}

/** One line per item, or one line for all when there are too many. */
function itemLines(items, line, summary) {
  if (items.length === 0) return [];
  return items.length > MAX_ITEM_LINES ? [{ videoId: null, text: summary(items.length) }] : items.map(line);
}

function channelLines(before, after) {
  return LIST_NAMES.flatMap((list) => {
    const old = before.lists[list];
    const now = after.lists[list];
    const id = (channel) => channel.id;
    const named = (channel) => `channel ${channel.id} ${JSON.stringify(channel.name)}`;
    return [
      ...itemLines(missing(old, now, id), (channel) => ({ videoId: null, text: `${named(channel)} added to the ${list} list` }), (count) => `${count} channels added to the ${list} list`),
      ...itemLines(missing(now, old, id), (channel) => ({ videoId: null, text: `${named(channel)} removed from the ${list} list` }), (count) => `${count} channels removed from the ${list} list`),
    ];
  });
}

function videoLines(before, after) {
  const id = (video) => video.videoId;
  return [
    ...itemLines(missing(before.excludedVideos, after.excludedVideos, id), (video) => ({ videoId: video.videoId, text: 'video excluded for good' }), (count) => `${count} videos excluded for good`),
    ...itemLines(missing(after.excludedVideos, before.excludedVideos, id), (video) => ({ videoId: video.videoId, text: 'video no longer excluded' }), (count) => `${count} videos no longer excluded`),
  ];
}

/**
 * @param {object} before Settings returned by normalizeSettings.
 * @param {object} after Settings returned by normalizeSettings.
 * @returns {{ videoId: string|null, text: string }[]} Empty when nothing changed.
 */
export function settingsChanges(before, after) {
  return [...valueLines(before, after), ...channelLines(before, after), ...videoLines(before, after)];
}
