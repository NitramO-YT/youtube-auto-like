/**
 * Background service worker: looks for a new version at the frequency set
 * in the settings, and shows a badge on the toolbar icon when one is out;
 * brings the content scripts to the YouTube tabs already open when the
 * extension is installed or updated.
 *
 * Chromium stops the service worker after a short idle time, so nothing is
 * kept in memory: the schedule is an alarm, everything else is in storage,
 * and every listener is registered as soon as the script runs.
 */
import { availableUpdate, isCheckDue } from '../core/update.js';
import { api } from '../platform/api.js';
import { acceptedMessage, Message } from '../platform/messages.js';
import { createStore } from '../platform/storage.js';
import { injectIntoOpenTabs } from './inject.js';
import { checkForUpdate } from './updates.js';

const ALARM = 'update-check';
const LOG_PREFIX = '[YouTube Auto Like]';
const BADGE_COLOR = '#d93025';

const store = createStore(api);
const version = api.runtime.getManifest().version;

/** The badge and the title of the icon, from the stored state and settings. */
async function refreshBadge() {
  const [settings, state] = await Promise.all([store.loadSettings(), store.loadUpdateState()]);
  const update = settings.updateCheckMinutes > 0 ? availableUpdate(state, version) : null;
  await api.action.setBadgeText({ text: update ? api.i18n.getMessage('badgeUpdate') : '' });
  if (update) await api.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  await api.action.setTitle({
    title: update ? api.i18n.getMessage('updateAvailableTitle', [update.version]) : api.i18n.getMessage('extensionName'),
  });
}

/** Sets the alarm to the frequency of the settings, or removes it. */
async function schedule() {
  const { updateCheckMinutes: minutes } = await store.loadSettings();
  const alarm = await api.alarms.get(ALARM);
  if (minutes === 0) {
    if (alarm) await api.alarms.clear(ALARM);
  } else if (alarm?.periodInMinutes !== minutes) {
    await api.alarms.create(ALARM, { delayInMinutes: minutes, periodInMinutes: minutes });
  }
}

/** Checks now, when checks are on; with `onlyIfDue`, only when the last answer is old enough. */
async function check({ onlyIfDue = false } = {}) {
  const { updateCheckMinutes: minutes } = await store.loadSettings();
  const state = await store.loadUpdateState();
  if (minutes === 0 || (onlyIfDue && !isCheckDue(state, minutes, Date.now()))) {
    await refreshBadge();
    return state;
  }
  const checked = await checkForUpdate({ fetch: (...args) => fetch(...args), store });
  await refreshBadge();
  return checked;
}

function run(task, what) {
  return task().catch((error) => console.error(LOG_PREFIX, `could not ${what}`, error));
}

// Installing or updating the extension (an unpacked one reloaded included);
// the other reasons, a browser update for instance, leave the scripts of the
// open tabs running.
const INJECTING_REASONS = ['install', 'update'];

api.runtime.onInstalled.addListener(({ reason }) => {
  if (INJECTING_REASONS.includes(reason)) run(() => injectIntoOpenTabs(api), 'reach the YouTube tabs already open');
  run(() => schedule().then(() => check({ onlyIfDue: true })), 'set the version checks up');
});
api.runtime.onStartup.addListener(() => {
  run(() => schedule().then(() => check({ onlyIfDue: true })), 'set the version checks up');
});
api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) run(() => check(), 'look for a new version');
});
store.onSettingsChange(() => {
  run(() => schedule().then(refreshBadge), 'apply the version check settings');
});

// "Check now", from the options page: answers with the new state.
api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (acceptedMessage(message, sender, api.runtime.id) !== Message.CHECK_UPDATES) return false;
  check().then(
    (state) => sendResponse({ state }),
    (error) => {
      console.error(LOG_PREFIX, 'could not look for a new version', error);
      sendResponse({ state: null });
    },
  );
  // The answer comes asynchronously.
  return true;
});
