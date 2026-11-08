/**
 * Runs the actions of an extension page one after the other, in the order
 * they were asked, and turns a failure into a notice: a full channel list is
 * explained, any other failure is reported as not saved and logged with its
 * cause.
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
 * @param {{ show: Function }} notice From createNotice.
 * @returns {(action: () => unknown) => Promise<void>} Resolves once the
 *   action has run, after those asked before it.
 */
export function createActionRunner(notice, t, lang) {
  let queue = Promise.resolve();
  return (action) => {
    queue = queue.then(action).catch((error) => {
      if (error instanceof ListFullError) {
        notice.show(t('noticeListFull', [formatNumber(error.max, lang)]), { error: true });
      } else {
        console.error(LOG_PREFIX, 'action failed', error);
        notice.show(t('noticeSaveFailed'), { error: true });
      }
    });
    return queue;
  };
}
