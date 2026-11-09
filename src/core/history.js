/**
 * History of the likes the extension made: the last MAX_HISTORY videos,
 * newest first, kept in the browser only. Each entry is
 * { videoId, title, channelId, channelName, channelAvatarUrl, isShort, likedAt }.
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

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object' || !isValidVideoId(entry.videoId)) return null;
  const likedAt = typeof entry.likedAt === 'string' && entry.likedAt.length <= 40 && !Number.isNaN(Date.parse(entry.likedAt)) ? entry.likedAt : null;
  if (!likedAt) return null;
  return {
    videoId: entry.videoId,
    title: text(entry.title, MAX_TITLE_LENGTH),
    channelId: isValidChannelId(entry.channelId) ? entry.channelId : null,
    channelName: text(entry.channelName, MAX_NAME_LENGTH),
    channelAvatarUrl: storedAvatarUrl(entry.channelAvatarUrl),
    isShort: entry.isShort === true,
    likedAt,
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
  };
}
