/**
 * Videos the user excluded for good ("Never like this video"): never liked
 * until the user takes them out of the list. Each entry is
 * { videoId, title, channelId, channelName, channelAvatarUrl, isShort, addedAt };
 * the video ID is what counts, the rest is for display. channelId is null
 * for an entry saved without it.
 */
import { storedAvatarUrl } from './avatar.js';
import { isValidChannelId, ListFullError } from './channels.js';
import { isValidVideoId } from './video.js';

export const MAX_EXCLUDED_VIDEOS = 5000;
export const MAX_TITLE_LENGTH = 300;
export const MAX_NAME_LENGTH = 200;

const text = (value, maxLength) => (typeof value === 'string' ? value.slice(0, maxLength) : '');
const validDate = (value) =>
  typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value)) ? value : null;

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object' || !isValidVideoId(entry.videoId)) return null;
  return {
    videoId: entry.videoId,
    title: text(entry.title, MAX_TITLE_LENGTH),
    channelId: isValidChannelId(entry.channelId) ? entry.channelId : null,
    channelName: text(entry.channelName, MAX_NAME_LENGTH),
    channelAvatarUrl: storedAvatarUrl(entry.channelAvatarUrl),
    isShort: entry.isShort === true,
    addedAt: validDate(entry.addedAt),
  };
}

/** The valid entries, in their order, one per video, within MAX_EXCLUDED_VIDEOS. */
export function normalizeExcludedVideos(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const videos = [];
  for (const entry of raw) {
    if (videos.length >= MAX_EXCLUDED_VIDEOS) break;
    const valid = normalizeEntry(entry);
    if (!valid || seen.has(valid.videoId)) continue;
    seen.add(valid.videoId);
    videos.push(valid);
  }
  return videos;
}

export function isVideoExcluded(videos, videoId) {
  return videos.some((video) => video.videoId === videoId);
}

/**
 * Adds a video to the excluded ones (first in the list), or takes it out
 * with exclude false. A video already excluded keeps its place and its date.
 * Returns a new list; the input is not modified.
 *
 * @param {object} video { videoId, title, channelId, channelName, channelAvatarUrl, isShort, addedAt }
 * @throws {Error} for an invalid video ID; ListFullError when the list is full.
 */
export function placeVideo(videos, video, exclude) {
  if (!isValidVideoId(video?.videoId)) throw new Error(`Invalid video ID: ${video?.videoId}`);
  const without = videos.filter((existing) => existing.videoId !== video.videoId);
  if (!exclude) return without;
  if (isVideoExcluded(videos, video.videoId)) return videos;
  if (videos.length >= MAX_EXCLUDED_VIDEOS) throw new ListFullError('videos', MAX_EXCLUDED_VIDEOS);
  return [normalizeEntry(video), ...videos];
}
