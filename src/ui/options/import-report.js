/**
 * The words of the import and add dialogs, from the report of planImport
 * (core/lists-import.js) and the results of the channel lookup. Pure: texts
 * come from t, numbers are formatted in lang.
 */
import { listOf } from '../../core/channels.js';
import { ImportPart } from '../../core/lists-import.js';
import { formatNumber, pluralKey } from '../shared/format.js';
import { LookupError } from './channel-lookup.js';

export const PART_LABELS = Object.freeze({
  [ImportPart.ALWAYS]: 'listAlways',
  [ImportPart.NEVER]: 'listNever',
  [ImportPart.VIDEOS]: 'listVideos',
});

const COUNT_KEYS = [
  ['added', 'reportAddedOne', 'reportAddedOther'],
  ['moved', 'reportMovedOne', 'reportMovedOther'],
  ['unchanged', 'reportUnchangedOne', 'reportUnchangedOther'],
  ['removed', 'reportRemovedOne', 'reportRemovedOther'],
];

/** "3 new · 1 moved", for the counts of `fields` that are not zero; null when all are. */
function countsText(counts, fields, t, lang) {
  const parts = COUNT_KEYS.filter(([field]) => fields.includes(field) && counts[field] > 0).map(([field, one, other]) =>
    t(pluralKey(counts[field], lang, one, other), [formatNumber(counts[field], lang)]),
  );
  return parts.length ? parts.join(' · ') : null;
}

const ALL_FIELDS = COUNT_KEYS.map(([field]) => field);

/**
 * One line per imported part: "Always like: 3 new · 1 moved". A part with
 * nothing in it says so.
 */
export function reportLines(report, t, lang) {
  return Object.entries(report).map(([part, counts]) =>
    t('reportPart', [t(PART_LABELS[part]), countsText(counts, ALL_FIELDS, t, lang) ?? t('reportPartEmpty')]),
  );
}

/** What an import changed, all parts together: "3 new · 2 removed". */
export function totalsLine(report, t, lang) {
  const totals = { added: 0, moved: 0, removed: 0 };
  for (const counts of Object.values(report)) {
    for (const field of Object.keys(totals)) totals[field] += counts[field];
  }
  return countsText(totals, Object.keys(totals), t, lang) ?? t('reportPartEmpty');
}

/** Entries the import takes out of the lists. */
export function removedCount(report) {
  return Object.values(report).reduce((total, counts) => total + counts.removed, 0);
}

const LOOKUP_ERRORS = {
  [LookupError.NOT_A_LINK]: 'lookupNotALink',
  [LookupError.NOT_FOUND]: 'lookupNotFound',
  [LookupError.UNREADABLE]: 'lookupUnreadable',
};

/**
 * What happens to the channel of each looked-up line when it goes to the
 * target list: { line, channel, text, ok }. ok is false for a line that
 * names no channel; a channel named by an earlier line is said once.
 */
export function lookupLines(results, lists, target, t) {
  const seen = new Set();
  return results.map(({ line, channel, error }) => {
    if (error) return { line, channel: null, text: t(LOOKUP_ERRORS[error]), ok: false };
    if (seen.has(channel.id)) return { line, channel, text: t('lookupDuplicate'), ok: true };
    seen.add(channel.id);
    const from = listOf(lists, channel.id);
    let text = t('lookupNew');
    if (from === target) text = t('lookupAlready');
    else if (from) text = t('lookupMoved', [t(PART_LABELS[from]), t(PART_LABELS[target])]);
    return { line, channel, text, ok: true };
  });
}
