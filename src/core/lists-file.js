/**
 * The file the options page exports the lists to, and imports them from:
 * JSON, { format, version, exportedAt, always, never, excludedVideos }. The
 * channel lists hold { id, name, addedAt } entries, the excluded videos
 * { videoId, title, channelName, isShort, addedAt } ones. excludedVideos may
 * be missing from a file.
 *
 * An imported file is untrusted: its size is bounded, its format must be
 * this one, and its lists go through normalizeLists and
 * normalizeExcludedVideos, which keep valid IDs and known fields only.
 */
import { normalizeLists } from './channels.js';
import { normalizeExcludedVideos } from './excluded-videos.js';

export const LISTS_FILE_FORMAT = 'youtube-auto-like/channel-lists';
export const LISTS_FILE_VERSION = 1;
// Two lists of MAX_CHANNELS entries take well under 2 MB.
export const MAX_LISTS_FILE_BYTES = 2 * 1024 * 1024;

export const ImportError = Object.freeze({
  TOO_BIG: 'too-big',
  INVALID: 'invalid',
});

/** The text of an export file. */
export function serializeLists(lists, excludedVideos, exportedAt) {
  const data = {
    format: LISTS_FILE_FORMAT,
    version: LISTS_FILE_VERSION,
    exportedAt,
    always: lists.always,
    never: lists.never,
    excludedVideos,
  };
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** The name proposed for an export file: youtube-auto-like-lists-2026-11-08.json. */
export function listsFileName(date) {
  return `youtube-auto-like-lists-${date.toISOString().slice(0, 10)}.json`;
}

/**
 * @param {string} text Content of the file.
 * @param {number} size Size of the file in bytes.
 * @returns {{ lists: object, excludedVideos: object[] } | { error: string }}
 *   lists from normalizeLists and excludedVideos from
 *   normalizeExcludedVideos, or an ImportError.
 */
export function parseListsFile(text, size) {
  if (size > MAX_LISTS_FILE_BYTES) return { error: ImportError.TOO_BIG };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: ImportError.INVALID };
  }
  if (!data || typeof data !== 'object' || data.format !== LISTS_FILE_FORMAT || data.version !== LISTS_FILE_VERSION) {
    return { error: ImportError.INVALID };
  }
  return {
    lists: normalizeLists({ always: data.always, never: data.never }),
    excludedVideos: normalizeExcludedVideos(data.excludedVideos),
  };
}
