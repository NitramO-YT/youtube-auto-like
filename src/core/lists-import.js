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

const emptyCounts = () => ({ added: 0, moved: 0, unchanged: 0, removed: 0 });

/** In REPLACE, the channels of a list that no imported channel part holds go. */
function removeAbsentChannels(lists, incoming, parts, report) {
  const imported = new Set(parts.flatMap((part) => incoming[part].map((channel) => channel.id)));
  let next = lists;
  for (const part of parts) {
    const kept = next[part].filter((channel) => imported.has(channel.id));
    report[part].removed = next[part].length - kept.length;
    next = { ...next, [part]: kept };
  }
  return next;
}

function placeChannels(lists, entries, part, mode, now, counts) {
  let next = lists;
  // placeChannel puts a new channel first: going through the import from its
  // end keeps its order at the top of the list.
  for (const entry of [...entries].reverse()) {
    const from = listOf(next, entry.id);
    if (from && (from === part || mode === ImportMode.ADD_NEW)) {
      counts.unchanged += 1;
      // FOLLOW and REPLACE refresh the name and the avatar, in place.
      if (from === part && mode !== ImportMode.ADD_NEW) next = placeChannel(next, entry, part, now);
      continue;
    }
    next = placeChannel(next, entry, part, entry.addedAt ?? now);
    if (from) counts.moved += 1;
    else counts.added += 1;
  }
  return next;
}

function placeVideos(current, entries, mode, counts) {
  let videos = current;
  if (mode === ImportMode.REPLACE) {
    const imported = new Set(entries.map((video) => video.videoId));
    videos = videos.filter((video) => imported.has(video.videoId));
    counts.removed = current.length - videos.length;
  }
  for (const entry of [...entries].reverse()) {
    if (isVideoExcluded(videos, entry.videoId)) {
      counts.unchanged += 1;
      continue;
    }
    videos = placeVideo(videos, entry, true);
    counts.added += 1;
  }
  return videos;
}

/**
 * @param {{ lists: object, excludedVideos: object[] }} current From the settings.
 * @param {{ always?: object[], never?: object[], videos?: object[] }} incoming
 *   The parts to import, normalized (normalizeLists, normalizeExcludedVideos).
 * @param {string} mode One of IMPORT_MODES.
 * @param {string} now ISO date given to entries that have none.
 * @returns {{ lists: object, excludedVideos: object[], report: object }}
 *   report holds, for each imported part, { added, moved, unchanged, removed }.
 * @throws {ListFullError} when a list would go past its maximum size.
 */
export function planImport(current, incoming, mode, now) {
  if (!IMPORT_MODES.includes(mode)) throw new Error(`Unknown import mode: ${mode}`);
  const parts = CHANNEL_PARTS.filter((part) => Array.isArray(incoming[part]));
  const report = Object.fromEntries(parts.map((part) => [part, emptyCounts()]));
  let lists = current.lists;
  if (mode === ImportMode.REPLACE) lists = removeAbsentChannels(lists, incoming, parts, report);
  for (const part of parts) lists = placeChannels(lists, incoming[part], part, mode, now, report[part]);

  let excludedVideos = current.excludedVideos;
  if (Array.isArray(incoming.videos)) {
    report.videos = emptyCounts();
    excludedVideos = placeVideos(excludedVideos, incoming.videos, mode, report.videos);
  }
  return { lists, excludedVideos, report };
}

/** Whether a report changes anything. */
export function importChanges(report) {
  return Object.values(report).some((counts) => counts.added + counts.moved + counts.removed > 0);
}
