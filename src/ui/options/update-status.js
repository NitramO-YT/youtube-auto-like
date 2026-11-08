/**
 * The sentence the options page shows about new versions, from the stored
 * state of the checks: a version out (with its page), up to date, nothing
 * published, a failed check, not checked yet, or checks switched off.
 */
import { availableUpdate } from '../../core/update.js';
import { formatAgo } from '../shared/format.js';

/**
 * @returns {{ text: string, url: string|null, error: boolean }}
 */
export function updateStatus(state, settings, version, t, lang, now) {
  if (settings.updateCheckMinutes === 0) return { text: t('updateStatusOff'), url: null, error: false };
  const update = availableUpdate(state, version);
  if (update) return { text: t('updateStatusAvailable', [update.version]), url: update.url, error: false };
  const failed = state.failedAt && (!state.checkedAt || Date.parse(state.failedAt) > Date.parse(state.checkedAt));
  if (failed) return { text: t('updateStatusFailed', [formatAgo(now - Date.parse(state.failedAt), lang)]), url: null, error: true };
  if (!state.checkedAt) return { text: t('updateStatusNever'), url: null, error: false };
  const when = formatAgo(now - Date.parse(state.checkedAt), lang);
  return { text: t(state.latest ? 'updateStatusUpToDate' : 'updateStatusNone', [when]), url: null, error: false };
}
