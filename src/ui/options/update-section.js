/**
 * New versions, in "More" on the options page: the state of the checks, with
 * the page of a version out, and "Check now", which asks the background to
 * check at once. The frequency itself is a field of the settings form.
 *
 * @param {object} page From index.js (see lists-section.js).
 */
import { Message } from '../../platform/messages.js';
import { updateStatus } from './update-status.js';

// How often the sentence ("checked 5 minutes ago") is brought up to date.
const REFRESH_MS = 30_000;

export function createUpdateSection(page, api) {
  const { byId, t, lang, store, notice, act, state } = page;
  const version = api.runtime.getManifest().version;
  let updateState = null;
  let checking = false;

  function render() {
    if (!updateState || !state.settings) return;
    const status = updateStatus(updateState, state.settings, version, t, lang, Date.now());
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
    byId('update-check').addEventListener('click', () => act(checkNow));
    store.onUpdateStateChange((changed) => {
      updateState = changed;
      render();
    });
    setInterval(render, REFRESH_MS);
  }

  return { start, listen, render };
}
