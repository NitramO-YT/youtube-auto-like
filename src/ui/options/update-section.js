/**
 * New versions, in "More" on the options page: how often to look for them
 * (a choice of frequencies, or a custom one as a count of minutes, hours or
 * days), the state of the checks with the page of a version out, and "Check
 * now", which asks the background to check at once.
 *
 * @param {object} page From index.js (see lists-section.js), with changeField.
 */
import { isValidCheckFrequency, UPDATE_CHECK_CHOICES } from '../../core/update.js';
import { Message } from '../../platform/messages.js';
import { pluralKey } from '../shared/format.js';
import { splitMinutes, toMinutes } from './fields.js';
import { updateStatus } from './update-status.js';

// How often the sentence ("checked 5 minutes ago") is brought up to date.
const REFRESH_MS = 30_000;
// What the custom fields first show when checks are off: every 2 hours.
const CUSTOM_START_MINUTES = 120;
// Names of the units of a custom frequency, by their value in minutes.
const UNIT_NAMES = {
  1: ['unitMinutesOne', 'unitMinutesOther'],
  60: ['unitHoursOne', 'unitHoursOther'],
  1440: ['unitDaysOne', 'unitDaysOther'],
};

export function createUpdateSection(page, api) {
  const { doc, byId, t, store, notice, act, state } = page;
  const version = api.runtime.getManifest().version;
  let updateState = null;
  let checking = false;
  // "Custom…" chosen, its fields shown, before a custom value is saved.
  let customOpen = false;

  /** Unit names that agree with the count typed: 1 hour, 2 hours. */
  function renderUnitNames() {
    const count = byId('update-custom-count').valueAsNumber;
    for (const option of byId('update-custom-unit').options) {
      const [one, other] = UNIT_NAMES[option.value];
      option.textContent = t(pluralKey(Number.isFinite(count) ? count : 2, page.lang,one, other));
    }
  }

  function renderFrequency() {
    const minutes = state.settings.updateCheckMinutes;
    const preset = UPDATE_CHECK_CHOICES.includes(minutes);
    const custom = customOpen || !preset;
    byId('update-every').value = custom ? 'custom' : String(minutes);
    byId('update-custom').hidden = !custom;
    if (!custom) return;
    // A field being typed in keeps what the user typed.
    const count = byId('update-custom-count');
    const unit = byId('update-custom-unit');
    if (doc.activeElement !== count && doc.activeElement !== unit) {
      const split = splitMinutes(minutes || CUSTOM_START_MINUTES);
      count.value = String(split.count);
      unit.value = String(split.unit);
    }
    renderUnitNames();
  }

  function render() {
    if (!state.settings) return;
    renderFrequency();
    if (!updateState) return;
    const status = updateStatus(updateState, state.settings, version, t, page.lang,Date.now());
    const text = byId('update-status');
    const link = byId('update-status-link');
    text.textContent = checking ? t('updateStatusChecking') : status.url ? '' : status.text;
    text.classList.toggle('error', status.error && !checking);
    link.hidden = checking || !status.url;
    if (status.url) {
      link.href = status.url;
      link.textContent = status.text;
    }
    byId('update-check').disabled = checking || state.settings.updateCheckMinutes === 0;
  }

  async function saveCustom() {
    const minutes = toMinutes(byId('update-custom-count').valueAsNumber, Number(byId('update-custom-unit').value));
    if (minutes === null || minutes === 0 || !isValidCheckFrequency(minutes)) {
      notice.show(t('noticeFrequencyInvalid'), { error: true });
      render();
      return;
    }
    customOpen = false;
    await page.changeField('updateCheckMinutes', minutes);
  }

  async function checkNow() {
    checking = true;
    render();
    try {
      const answer = await api.runtime.sendMessage({ type: Message.CHECK_UPDATES });
      if (answer?.state) updateState = answer.state;
      else notice.show(t('noticeCheckFailed'), { error: true });
    } finally {
      checking = false;
      render();
    }
  }

  /** Loads the state of the checks and shows it; throws when storage cannot be read. */
  async function start() {
    updateState = await store.loadUpdateState();
    render();
  }

  function listen() {
    byId('update-every').addEventListener('change', (event) => {
      if (event.target.value === 'custom') {
        customOpen = true;
        render();
        byId('update-custom-count').focus();
        return;
      }
      customOpen = false;
      const minutes = Number(event.target.value);
      act(() => page.changeField('updateCheckMinutes', minutes));
    });
    for (const id of ['update-custom-count', 'update-custom-unit']) {
      byId(id).addEventListener('change', () => act(saveCustom));
    }
    byId('update-custom-count').addEventListener('input', renderUnitNames);
    byId('update-check').addEventListener('click', () => act(checkNow));
    store.onUpdateStateChange((changed) => {
      updateState = changed;
      render();
    });
    setInterval(render, REFRESH_MS);
  }

  return { start, listen, render };
}
