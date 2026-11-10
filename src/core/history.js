/**
 * History of the likes the extension made: the last MAX_HISTORY videos,
 * newest first, kept in the browser only. Each entry is
 * { videoId, title, channelId, channelName, channelAvatarUrl, isShort, likedAt, removedAt }:
 * removedAt is the date the extension saw the like removed on the page, or
 * null while the like stands or was not seen removed (the extension only
 * sees what happens on a YouTube page it runs in).
 *
 * Like the settings, the history read from storage is untrusted:
 * normalizeHistory keeps valid entries with known fields and bounded texts.
 */
import { storedAvatarUrl } from './avatar.js';
import { isValidChannelId } from './channels.js';
import { isValidVideoId } from './video.js';

export const MAX_HISTORY = 500;
const MAX_TITLE_LENGTH = 300;
const MAX_NAME_LENGTH = 200;

const text = (value, maxLength) => (typeof value === 'string' ? value.slice(0, maxLength) : '');
const validDate = (value) => (typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value)) ? value : null);

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object' || !isValidVideoId(entry.videoId)) return null;
  const likedAt = validDate(entry.likedAt);
  if (!likedAt) return null;
  return {
    videoId: entry.videoId,
    title: text(entry.title, MAX_TITLE_LENGTH),
    channelId: isValidChannelId(entry.channelId) ? entry.channelId : null,
    channelName: text(entry.channelName, MAX_NAME_LENGTH),
    channelAvatarUrl: storedAvatarUrl(entry.channelAvatarUrl),
    isShort: entry.isShort === true,
    likedAt,
    removedAt: validDate(entry.removedAt),
  };
}

/** The valid entries, in their order, one per video, within MAX_HISTORY. */
export function normalizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const history = [];
  for (const entry of raw) {
    if (history.length >= MAX_HISTORY) break;
    const valid = normalizeEntry(entry);
    if (!valid || seen.has(valid.videoId)) continue;
    seen.add(valid.videoId);
    history.push(valid);
  }
  return history;
}

/**
 * The history with a new like on top. A video liked again moves to the top
 * instead of showing twice; the oldest entries go past MAX_HISTORY. An
 * invalid entry leaves the history as it is.
 */
export function addToHistory(history, entry) {
  const valid = normalizeEntry(entry);
  if (!valid) return history;
  return [valid, ...history.filter((existing) => existing.videoId !== valid.videoId)].slice(0, MAX_HISTORY);
}

/** The history without the entry of a video. */
export function removeFromHistory(history, videoId) {
  return history.filter((entry) => entry.videoId !== videoId);
}

/**
 * The history with an entry put back at its place (the undo of
 * removeFromHistory), keeping the likes made since; unchanged when the video
 * is already there.
 */
export function insertIntoHistory(history, entry, index) {
  const valid = normalizeEntry(entry);
  if (!valid || history.some((existing) => existing.videoId === valid.videoId)) return history;
  const at = Math.min(Math.max(index, 0), history.length);
  return [...history.slice(0, at), valid, ...history.slice(at)].slice(0, MAX_HISTORY);
}

/**
 * The history with the like of a video marked as removed at a date, or as
 * standing again with null; the same array when the video has no entry or
 * already has that mark.
 *
 * @param {string|null} removedAt ISO date.
 */
export function markLikeRemoved(history, videoId, removedAt) {
  const index = history.findIndex((entry) => entry.videoId === videoId);
  if (index === -1 || Boolean(history[index].removedAt) === Boolean(removedAt)) return history;
  const marked = [...history];
  marked[index] = { ...history[index], removedAt: validDate(removedAt) };
  return marked;
}

/**
 * The history entry of a like, from what the page showed when the like
 * button was clicked: the snapshot of the page reader (see validateSnapshot
 * in content/protocol.js) and the channel avatar read in the page. Without
 * a snapshot, the entry keeps the video ID and the date only.
 *
 * @param {string} videoId
 * @param {object|null} snapshot
 * @param {number} likedAt Milliseconds.
 * @param {string|null} channelAvatarUrl
 */
export function historyEntry(videoId, snapshot, likedAt, channelAvatarUrl = null) {
  return {
    videoId,
    title: snapshot?.title ?? '',
    channelId: snapshot?.channelId ?? null,
    channelName: snapshot?.channelName ?? '',
    channelAvatarUrl: snapshot ? channelAvatarUrl : null,
    isShort: snapshot?.isShort === true,
    likedAt: new Date(likedAt).toISOString(),
    removedAt: null,
  };
}
