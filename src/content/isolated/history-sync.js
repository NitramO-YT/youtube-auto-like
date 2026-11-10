/**
 * Keeps the history in line with the like of the video watched: a video of
 * the history seen not liked shows its like as removed, and seen liked
 * again, as standing (storage.markHistoryLike). The like must read the same
 * for STABLE_FOR_MS first, as for a click: a button YouTube is redrawing
 * never decides. It also covers a like removed where the extension did not
 * run (another device, before an update), seen when the video opens again.
 *
 * Pure: the liker keeps the state, and does the marking it asks for.
 */
import { STABLE_FOR_MS } from './session.js';

/** The state for a new video: nothing read, nothing marked. */
export const initialSync = () => ({ liked: null, since: null, marked: null });

/**
 * @param {{ liked: boolean|null, since: number|null, marked: boolean|null }} state
 * @param {boolean|null} liked The like of the video now (likeState in session.js).
 * @param {number} now Milliseconds.
 * @returns {{ state: object, mark: boolean|null }} mark: true for a like to
 *   show as removed, false for one to show as standing, null for nothing to do.
 */
export function syncHistory(state, liked, now) {
  if (typeof liked !== 'boolean') return { state: { ...state, liked: null, since: null }, mark: null };
  if (liked !== state.liked) return { state: { ...state, liked, since: now }, mark: null };
  const removed = !liked;
  if (now - state.since < STABLE_FOR_MS || state.marked === removed) return { state, mark: null };
  return { state: { ...state, marked: removed }, mark: removed };
}
