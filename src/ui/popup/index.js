/**
 * Popup of the toolbar icon. While it is open, it asks the liker of the
 * current tab for the status of its video once a second, and offers the
 * on/off switch, the commands for the video and the channel lists.
 *
 * Each part of the popup is redrawn only when what it shows changes, so that
 * a button keeps the keyboard focus while the remaining time ticks.
 */
import './popup.css';
import { MAX_CHANNELS, listOf, placeChannel } from '../../core/channels.js';
import { api } from '../../platform/api.js';
import { Message } from '../../platform/messages.js';
import { createStore } from '../../platform/storage.js';
import { formatLikeCount, formatNumber } from '../shared/format.js';
import { createTranslator, translatePage } from '../shared/i18n.js';
import { ruleParts } from '../shared/rule.js';
import { renderActions, renderCard, renderChannel, renderRule } from './render.js';
import { Action, videoView } from './view.js';

const REFRESH_MS = 1000;
const NOTICE_MS = 8000;
const LOG_PREFIX = '[YouTube Auto Like]';

const t = createTranslator((key, substitutions) => api.i18n.getMessage(key, substitutions));
const lang = t('locale');
const store = createStore(api);
const byId = (id) => document.getElementById(id);

const state = {
  settings: null,
  tabId: null,
  // undefined until the tab has been asked; null when it did not answer.
  status: undefined,
  likeCount: null,
  notice: null,
};
let pendingUndo = null;
let noticeTimer = null;
let refreshing = false;
let acting = false;

const drawn = new Map();
function draw(name, model, paint) {
  const key = JSON.stringify(model);
  if (drawn.get(name) === key) return;
  drawn.set(name, key);
  paint(model);
}

function paintNotice(notice) {
  byId('notice').hidden = !notice;
  if (!notice) return;
  byId('notice').classList.toggle('error', notice.error);
  byId('notice-text').textContent = notice.text;
  byId('notice-undo').hidden = !notice.undoable;
}

function render() {
  draw('notice', state.notice, paintNotice);
  const { settings, status } = state;
  if (!settings) return;

  const paused = !settings.enabled;
  document.body.classList.toggle('paused', paused);
  draw('switch', paused, () => {
    const toggle = byId('enabled');
    toggle.disabled = false;
    toggle.setAttribute('aria-checked', String(!paused));
    byId('enabled-state').textContent = t(paused ? 'switchPaused' : 'switchActive');
  });
  byId('paused-banner').hidden = !paused;

  const view = status ? videoView(status, settings, t, lang, Date.now()) : null;
  byId('video').hidden = !view;
  byId('no-video').hidden = Boolean(view) || status === undefined;
  byId('no-video-hint').hidden = status !== null;
  if (view) {
    draw('channel', view.channel, (channel) => renderChannel(byId('video-channel'), channel));
    draw('card', view.card, (card) => renderCard(byId('video-card'), card));
    draw('actions', view.actions, (actions) => renderActions(byId('video-actions'), actions, t));
  }

  byId('rule-section').hidden = paused;
  draw('rule', ruleParts(settings, t, lang), (parts) => renderRule(byId('rule'), parts));
  draw('count', state.likeCount, (count) => {
    byId('like-count').textContent = count === null ? '' : formatLikeCount(count, lang, t);
  });
}

function showNotice(text, { error = false, undo = null } = {}) {
  clearTimeout(noticeTimer);
  state.notice = { text, error, undoable: Boolean(undo) };
  pendingUndo = undo;
  noticeTimer = setTimeout(() => {
    state.notice = null;
    pendingUndo = null;
    render();
  }, NOTICE_MS);
  render();
}

/** Sends a message to the liker of the current tab; its answer is the status of the video. */
async function ask(type) {
  if (state.tabId === null) return null;
  try {
    return (await api.tabs.sendMessage(state.tabId, { type })) ?? null;
  } catch {
    // No liker in this tab: not a YouTube page, or a YouTube page opened
    // before the extension was installed or reloaded. The popup says so.
    return null;
  }
}

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    state.status = await ask(Message.GET_STATUS);
    render();
  } finally {
    refreshing = false;
  }
}

async function videoCommand(type) {
  const status = await ask(type);
  if (status) state.status = status;
  else showNotice(t('noticeNoAnswer'), { error: true });
  render();
}

async function placeInList(channel, target, addedAt) {
  state.settings = await store.updateSettings((settings) => ({
    ...settings,
    lists: placeChannel(settings.lists, channel, target, addedAt),
  }));
  render();
}

function moveNoticeKey(target) {
  if (target === 'always') return 'noticeAddedAlways';
  return target === 'never' ? 'noticeAddedNever' : 'noticeRemovedNever';
}

/**
 * Moves the channel of the video to a list (null: out of both), and offers
 * to undo: the channel goes back to its previous list, with its date.
 */
async function moveChannel(target) {
  const channel = state.status?.channel;
  if (!channel || !state.settings) return;
  const { lists } = state.settings;
  const from = listOf(lists, channel.id);
  const entry = from ? lists[from].find((existing) => existing.id === channel.id) : null;
  if (target && from !== target && lists[target].length >= MAX_CHANNELS) {
    showNotice(t('noticeListFull', [formatNumber(MAX_CHANNELS, lang)]), { error: true });
    return;
  }
  const now = new Date().toISOString();
  await placeInList({ id: channel.id, name: channel.name ?? '' }, target, now);
  showNotice(t(moveNoticeKey(target)), {
    undo: async () => {
      await placeInList({ id: channel.id, name: entry?.name || channel.name || '' }, from, entry?.addedAt ?? now);
      showNotice(t('noticeUndone'));
    },
  });
}

const ACTIONS = {
  [Action.LIKE_NOW]: () => videoCommand(Message.LIKE_NOW),
  [Action.SKIP]: () => videoCommand(Message.SKIP_VIDEO),
  [Action.ALWAYS]: () => moveChannel('always'),
  [Action.NEVER]: () => moveChannel('never'),
  [Action.UNLIST_NEVER]: () => moveChannel(null),
};

/** Runs one user action at a time; a failure to save is shown, and logged. */
async function act(run) {
  if (acting) return;
  acting = true;
  try {
    await run();
  } catch (error) {
    console.error(LOG_PREFIX, 'action failed', error);
    showNotice(t('noticeSaveFailed'), { error: true });
  } finally {
    acting = false;
  }
}

function listen() {
  byId('enabled').addEventListener('click', () =>
    act(async () => {
      state.settings = await store.updateSettings((settings) => ({ ...settings, enabled: !settings.enabled }));
      render();
      refresh();
    }),
  );
  byId('video-actions').addEventListener('click', (event) => {
    const run = ACTIONS[event.target.closest('button[data-action]')?.dataset.action];
    if (run) act(run);
  });
  byId('notice-undo').addEventListener('click', () => {
    const undo = pendingUndo;
    pendingUndo = null;
    if (undo) act(undo);
  });
  byId('open-settings').addEventListener('click', () => {
    api.runtime.openOptionsPage().then(
      () => window.close(),
      (error) => console.error(LOG_PREFIX, 'could not open the options page', error),
    );
  });
  store.onSettingsChange((settings) => {
    state.settings = settings;
    render();
  });
  store.onLikeCountChange((count) => {
    state.likeCount = count;
    render();
  });
}

async function start() {
  document.documentElement.lang = lang;
  translatePage(document, t);
  byId('version').textContent = t('versionLabel', [api.runtime.getManifest().version]);
  try {
    state.settings = await store.loadSettings();
    state.likeCount = await store.loadLikeCount();
  } catch (error) {
    console.error(LOG_PREFIX, 'could not load the settings', error);
    showNotice(t('noticeLoadFailed'), { error: true });
    return;
  }
  listen();
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  state.tabId = tab?.id ?? null;
  await refresh();
  setInterval(refresh, REFRESH_MS);
}

start();
