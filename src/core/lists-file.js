/**
 * The file the options page exports the lists to, and imports them from:
 * JSON, { format, version, exportedAt, always, never, excludedVideos }. The
 * channel lists hold { id, name, avatarUrl, addedAt } entries, the excluded
 * videos { videoId, title, channelId, channelName, channelAvatarUrl, isShort,
 * addedAt } ones. excludedVideos may be missing from a file, and avatars and
 * the channelId of a video from its entries.
 *
 * An imported file is untrusted: its size is bounded, its format must be
 * this one, and its lists go through normalizeLists and
 * normalizeExcludedVideos, which keep valid IDs and known fields only.
 */
import { normalizeLists } from './channels.js';
import { normalizeExcludedVideos } from './excluded-videos.js';

export const LISTS_FILE_FORMAT = 'youtube-auto-like/channel-lists';
export const LISTS_FILE_VERSION = 1;
// Every list full, with names, titles and avatar addresses at their maximum
// length, makes a file of about 19.4 MB (tests/core/lists-file.test.mjs):
// any export of the extension is accepted back.
export const MAX_LISTS_FILE_BYTES = 24 * 1024 * 1024;

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

/** The name proposed for a list of links: youtube-auto-like-channels-2026-11-08.txt. */
export function linksFileName(date) {
  return `youtube-auto-like-channels-${date.toISOString().slice(0, 10)}.txt`;
}

/**
 * A list of links to read or to share: for each list given, a "# title"
 * line, then one channel per line, its address followed by "  # name".
 * The lines a user pastes are read back the same way (readLinkLines):
 * comments are left out.
 *
 * @param {Array<{ title: string, channels: object[] }>} sections
 */
export function serializeLinks(sections) {
  const lines = [];
  for (const { title, channels } of sections) {
    lines.push(`# ${title}`);
    for (const channel of channels) {
      const name = channel.name.replace(/\s+/g, ' ').trim();
      lines.push(`https://www.youtube.com/channel/${channel.id}${name ? `  # ${name}` : ''}`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * The lines of a pasted text or a list of links: trimmed, without comments
 * (a line starting with "#", or the end of a line from " #"), without empty
 * lines and repeats.
 */
export function readLinkLines(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, '').trim())
    .filter((line) => line && !line.startsWith('#'));
  return [...new Set(lines)];
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
