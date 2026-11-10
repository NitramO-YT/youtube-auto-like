/**
 * What changed on the rating buttons of a video between two observations,
 * as lines for the journal of the debug mode: a like or a dislike given or
 * removed on the page, by the user or by another extension. The session
 * (session.js) keeps its own state after a like, so without these lines the
 * journal would not tell why the popup offers to restart a video.
 */

const BUTTONS = [
  ['liked', 'like'],
  ['disliked', 'dislike'],
];

/**
 * Only a change between two known states counts: a button missing for a
 * moment while YouTube redraws the page reads null, and is not a change.
 *
 * @param {object|null} previous The observation before (liked, disliked),
 *   of the same video, or null for the first one.
 * @param {object} current The observation now.
 * @returns {string[]} Lines in English, the language of the reports.
 */
export function ratingChanges(previous, current) {
  if (!previous) return [];
  return BUTTONS.filter(([field]) => typeof previous[field] === 'boolean' && typeof current[field] === 'boolean' && previous[field] !== current[field]).map(
    ([field, name]) => `${name} ${current[field] ? 'given' : 'removed'} on the page`,
  );
}
