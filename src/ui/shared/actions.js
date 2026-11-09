/**
 * Runs the actions of an extension page one after the other, in the order
 * they were asked, and turns a failure into a notice (failureText): a full
 * list and a full storage are explained, any other failure is reported as
 * not saved and logged with its cause.
 *
 * Actions are queued, never dropped: a click made while a slow action runs
 * (reading an imported file, a busy storage) is carried out after it. An
 * action that must not apply twice on a double click computes its target
 * when it is asked (the switch is set to a value, not toggled).
 */
import { ListFullError } from '../../core/channels.js';
import { formatNumber } from './format.js';

const LOG_PREFIX = '[YouTube Auto Like]';

/**
 * Whether a write failed because storage.local is full: 10 MB without the
 * unlimitedStorage permission (Chrome documentation, 9 November 2026), which
 * only lists of several thousand entries with very long names reach.
 * Chromium rejects such a write with "QUOTA_BYTES quota exceeded" (message
 * from its documentation, not observed in this project).
 */
export function isStorageFull(error) {
  return /QUOTA_BYTES/i.test(String(error?.message ?? error));
}

/** What to tell the user of a failed change; any unexplained failure is logged. */
export function failureText(error, t, lang) {
  if (error instanceof ListFullError) return t('noticeListFull', [formatNumber(error.max, lang)]);
  if (isStorageFull(error)) return t('noticeStorageFull');
  console.error(LOG_PREFIX, 'action failed', error);
  return t('noticeSaveFailed');
}

/**
 * @param {{ show: Function }} notice From createNotice.
 * @returns {(action: () => unknown) => Promise<void>} Resolves once the
 *   action has run, after those asked before it.
 */
export function createActionRunner(notice, t, lang) {
  let queue = Promise.resolve();
  return (action) => {
    queue = queue.then(action).catch((error) => {
      notice.show(failureText(error, t, lang), { error: true });
    });
    return queue;
  };
}
