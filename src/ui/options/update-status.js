/**
 * The sentence the options page shows about new versions, from the stored
 * state of the checks: a version out (with its page), up to date, nothing
 * published, a failed check, not checked yet, or checks switched off.
 */
import { availableUpdate } from '../../core/update.js';
import { formatAgo } from '../shared/format.js';

/**
 * @param {boolean} selfUpdating Whether the browser installs new versions by itself (updatesItself).
 * @returns {{ text: string, url: string|null, error: boolean, note: string|null }} note: a
 *   sentence to show under it, saying that the browser installs the version out.
 */
export function updateStatus(state, settings, version, t, lang, now, selfUpdating = false) {
  const status = (text, url = null, error = false, note = null) => ({ text, url, error, note });
  if (settings.updateCheckMinutes === 0) return status(t('updateStatusOff'));
  const update = availableUpdate(state, version);
  if (update) return status(t('updateStatusAvailable', [update.version]), update.url, false, selfUpdating ? t('updateInstallsItself') : null);
  const failed = state.failedAt && (!state.checkedAt || Date.parse(state.failedAt) > Date.parse(state.checkedAt));
  if (failed) return status(t('updateStatusFailed', [formatAgo(now - Date.parse(state.failedAt), lang)]), null, true);
  if (!state.checkedAt) return status(t('updateStatusNever'));
  const when = formatAgo(now - Date.parse(state.checkedAt), lang);
  return status(t(state.latest ? 'updateStatusUpToDate' : 'updateStatusNone', [when]));
}
