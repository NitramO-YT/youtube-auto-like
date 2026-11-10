/**
 * Puts entries coming from outside (an import file, a list of links) into
 * the user's lists, the same way for the analysis shown before and for the
 * change made after: planImport is pure, the options page only stores its
 * result.
 *
 * Each part of the import (the "always like" list, the "never like" list,
 * the excluded videos) is imported only when it is given. What happens to
 * the entries the user already has depends on the mode:
 *   ADD_NEW  adds what is not there yet; a channel already in a list stays
 *            where it is, even if the import puts it in the other one;
 *   FOLLOW   also moves a channel to the list the import gives it, and
 *            refreshes its name and avatar;
 *   REPLACE  FOLLOW, then takes out of each imported part what the import
 *            does not hold.
 * A channel the import moves from one list to the other counts as moved,
 * never as removed and added again.
 */
import { listOf, placeChannel } from './channels.js';
import { isVideoExcluded, placeVideo } from './excluded-videos.js';

export const ImportMode = Object.freeze({ ADD_NEW: 'add-new', FOLLOW: 'follow', REPLACE: 'replace' });
export const IMPORT_MODES = Object.freeze([ImportMode.ADD_NEW, ImportMode.FOLLOW, ImportMode.REPLACE]);
export const ImportPart = Object.freeze({ ALWAYS: 'always', NEVER: 'never', VIDEOS: 'videos' });
export const IMPORT_PARTS = Object.freeze([ImportPart.ALWAYS, ImportPart.NEVER, ImportPart.VIDEOS]);
const CHANNEL_PARTS = [ImportPart.ALWAYS, ImportPart.NEVER];

export const EntryFate = Object.freeze({ ADDED: 'added', MOVED: 'moved', UNCHANGED: 'unchanged', REMOVED: 'removed' });
const FATE_ORDER = [EntryFate.ADDED, EntryFate.MOVED, EntryFate.REMOVED, EntryFate.UNCHANGED];

const emptyCounts = () => ({ added: 0, moved: 0, unchanged: 0, removed: 0 });

/** Counts an entry, and notes it in the details: { fate, entry, from }. */
function note(counts, details, fate, entry, from = null) {
  counts[fate] += 1;
  details.push({ fate, entry, from });
}

/** In REPLACE, the channels of a list that no imported channel part holds go. */
function removeAbsentChannels(lists, incoming, parts, report, details) {
  const imported = new Set(parts.flatMap((part) => incoming[part].map((channel) => channel.id)));
  let next = lists;
  for (const part of parts) {
    for (const channel of next[part]) {
      if (!imported.has(channel.id)) note(report[part], details[part], EntryFate.REMOVED, channel);
    }
    next = { ...next, [part]: next[part].filter((channel) => imported.has(channel.id)) };
  }
  return next;
}

function placeChannels(lists, entries, part, mode, now, counts, details) {
  let next = lists;
  const placed = [];
  // placeChannel puts a new channel first: going through the import from its
  // end keeps its order at the top of the list.
  for (const entry of [...entries].reverse()) {
    const from = listOf(next, entry.id);
    if (from && (from === part || mode === ImportMode.ADD_NEW)) {
      placed.push({ fate: EntryFate.UNCHANGED, entry, from: from === part ? null : from });
      // FOLLOW and REPLACE refresh the name and the avatar, in place.
      if (from === part && mode !== ImportMode.ADD_NEW) next = placeChannel(next, entry, part, now);
      continue;
    }
    next = placeChannel(next, entry, part, entry.addedAt ?? now);
    placed.push({ fate: from ? EntryFate.MOVED : EntryFate.ADDED, entry, from });
  }
  // The details follow the order of the import.
  for (const { fate, entry, from } of placed.reverse()) note(counts, details, fate, entry, from);
  return next;
}

function placeVideos(current, entries, mode, counts, details) {
  let videos = current;
  if (mode === ImportMode.REPLACE) {
    const imported = new Set(entries.map((video) => video.videoId));
    for (const video of current) {
      if (!imported.has(video.videoId)) note(counts, details, EntryFate.REMOVED, video);
    }
    videos = videos.filter((video) => imported.has(video.videoId));
  }
  const placed = [];
  for (const entry of [...entries].reverse()) {
    if (isVideoExcluded(videos, entry.videoId)) {
      placed.push(EntryFate.UNCHANGED);
      continue;
    }
    videos = placeVideo(videos, entry, true);
    placed.push(EntryFate.ADDED);
  }
  placed.reverse().forEach((fate, index) => note(counts, details, fate, entries[index]));
  return videos;
}

/** The details of a part, the entries that change first: added, moved, removed, then unchanged. */
function sortDetails(details) {
  return [...details].sort((a, b) => FATE_ORDER.indexOf(a.fate) - FATE_ORDER.indexOf(b.fate));
}

/**
 * @param {{ lists: object, excludedVideos: object[] }} current From the settings.
 * @param {{ always?: object[], never?: object[], videos?: object[] }} incoming
 *   The parts to import, normalized (normalizeLists, normalizeExcludedVideos).
 * @param {string} mode One of IMPORT_MODES.
 * @param {string} now ISO date given to entries that have none.
 * @returns {{ lists: object, excludedVideos: object[], report: object, details: object }}
 *   report holds, for each imported part, { added, moved, unchanged, removed };
 *   details, for each imported part, every entry concerned as
 *   { fate, entry, from }: fate one of EntryFate, entry the channel or the
 *   video, from the list a moved channel comes from (or, for a channel left
 *   in place by ADD_NEW, the list it stays in), else null. The entries that
 *   change come first.
 * @throws {ListFullError} when a list would go past its maximum size.
 */
export function planImport(current, incoming, mode, now) {
  if (!IMPORT_MODES.includes(mode)) throw new Error(`Unknown import mode: ${mode}`);
  const parts = CHANNEL_PARTS.filter((part) => Array.isArray(incoming[part]));
  const report = Object.fromEntries(parts.map((part) => [part, emptyCounts()]));
  const details = Object.fromEntries(parts.map((part) => [part, []]));
  let lists = current.lists;
  if (mode === ImportMode.REPLACE) lists = removeAbsentChannels(lists, incoming, parts, report, details);
  for (const part of parts) lists = placeChannels(lists, incoming[part], part, mode, now, report[part], details[part]);

  let excludedVideos = current.excludedVideos;
  if (Array.isArray(incoming.videos)) {
    report.videos = emptyCounts();
    details.videos = [];
    excludedVideos = placeVideos(excludedVideos, incoming.videos, mode, report.videos, details.videos);
  }
  for (const part of Object.keys(details)) details[part] = sortDetails(details[part]);
  return { lists, excludedVideos, report, details };
}

/** Whether a report changes anything. */
export function importChanges(report) {
  return Object.values(report).some((counts) => counts.added + counts.moved + counts.removed > 0);
}
