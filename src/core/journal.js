/**
 * Journal of what the extension does, for the debug mode and the report of
 * a problem: the steps of each video (read, waiting, clicked, liked, why it
 * is not liked) and the errors. Each entry is { at, videoId, text }: at the
 * ISO date, videoId the video concerned or null, text a short line in
 * English, the language of the reports.
 *
 * It holds the IDs of the videos watched: the liker keeps it only while the
 * debug mode is on, in this browser only, and a report includes it only
 * when the user leaves it in.
 */
import { isValidVideoId } from './video.js';

export const MAX_JOURNAL = 200;
const MAX_TEXT_LENGTH = 300;

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const { at, videoId, text } = entry;
  if (typeof at !== 'string' || at.length > 40 || Number.isNaN(Date.parse(at))) return null;
  if (typeof text !== 'string' || !text.trim()) return null;
  return { at, videoId: isValidVideoId(videoId) ? videoId : null, text: text.slice(0, MAX_TEXT_LENGTH) };
}

/** The valid entries, oldest first, the last MAX_JOURNAL of them. */
export function normalizeJournal(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeEntry).filter(Boolean).slice(-MAX_JOURNAL);
}

/** The journal with entries added at its end; the oldest go past MAX_JOURNAL. */
export function addToJournal(journal, entries) {
  return [...journal, ...entries.map(normalizeEntry).filter(Boolean)].slice(-MAX_JOURNAL);
}

/** One entry: { at, videoId, text } at the date given (milliseconds). */
export function journalEntry(at, videoId, text) {
  return { at: new Date(at).toISOString(), videoId: videoId ?? null, text };
}

/** The journal as text, one line per entry: "2026-11-09 02:10:03 aeP4eG-gO10 waiting, at 562 s (percent)". */
export function journalText(journal) {
  return journal.map(({ at, videoId, text }) => `${at.slice(0, 19).replace('T', ' ')} ${videoId ?? '-'} ${text}`).join('\n');
}
