/**
 * Popup of the toolbar icon. While it is open, it asks the liker of the
 * current tab for the status of its video once a second, and offers the
 * on/off switch, the commands for the video and the channel lists.
 *
 * Each part of the popup is redrawn only when what it shows changes, so that
 * a button keeps the keyboard focus while the remaining time ticks.
 */
import './popup.css';
import { availableUpdate } from '../../core/update.js';
import { api } from '../../platform/api.js';
import { Message } from '../../platform/messages.js';
import { createStore } from '../../platform/storage.js';
import { createActionRunner } from '../shared/actions.js';
import { markReady, renderParts } from '../shared/dom.js';
import { embeddedOptionsUrl } from '../shared/embed.js';
import { formatLikeCount } from '../shared/format.js';
import { createTranslator, translatePage } from '../shared/i18n.js';
import { moveChannel, setVideoExcluded } from '../shared/lists.js';
import { createNotice } from '../shared/notice.js';
import { ruleParts } from '../shared/rule.js';
import { applyTheme } from '../shared/theme.js';
import { renderActions, renderCard, renderChannel } from './render.js';
import { Action, videoView } from './view.js';

const REFRESH_MS = 1000;
const LOG_PREFIX = '[YouTube Auto Like]';

const t = createTranslator((key, substitutions) => api.i18n.getMessage(key, substitutions));
const lang = t('locale');
const store = createStore(api);
const byId = (id) => document.getElementById(id);

const VERSION = api.runtime.getManifest().version;

const state = {
  settings: null,
  tabId: null,
  // undefined until the tab has been asked; null when it did not answer.
  status: undefined,
  likeCount: null,
  update: null,
};
let refreshing = false;

const notice = createNotice(
  { box: byId('notice'), text: byId('notice-text'), undoButton: byId('notice-undo') },
  { run: (action) => act(action) },
);
const act = createActionRunner(notice, t, lang);

const drawn = new Map();
function draw(name, model, paint) {
  const key = JSON.stringify(model);
  if (drawn.get(name) === key) return;
  drawn.set(name, key);
  paint(model);
}

function render() {
  const { settings, status } = state;
  if (!settings) return;

  draw('theme', settings.theme, (theme) => applyTheme(document, theme, window.localStorage));
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
    draw('title', view.title, (title) => {
      const element = byId('video-title');
      element.hidden = !title;
      element.textContent = title ?? '';
      // Cut to two lines on screen; the full title on hover.
      element.title = title ?? '';
    });
    draw('channel', view.channel, (channel) => renderChannel(byId('video-channel'), channel));
    draw('card', view.card, (card) => renderCard(byId('video-card'), card));
    draw('actions', view.actions, (actions) => renderActions(byId('video-actions'), actions, t));
  }

  byId('rule-section').hidden = paused;
  draw('rule', ruleParts(settings, t, lang), (parts) => renderParts(byId('rule'), parts));
  draw('count', state.likeCount, (count) => {
    byId('like-count').textContent = count === null ? '' : formatLikeCount(count, lang, t);
  });
  // A new version takes the place of the version number.
  const update = settings.updateCheckMinutes > 0 && state.update ? availableUpdate(state.update, VERSION) : null;
  draw('update', update, (release) => {
    const link = byId('update-link');
    link.hidden = !release;
    byId('version').hidden = Boolean(release);
    if (!release) return;
    link.href = release.url;
    link.textContent = t('updateFooter', [release.version]);
  });
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
  else notice.show(t('noticeNoAnswer'), { error: true });
  render();
  return status;
}

/** "Not this time", with an undo that sends the video through the checks again. */
async function skipThisTime() {
  if (!(await videoCommand(Message.SKIP_VIDEO))) return;
  notice.show(t('noticeSkipped'), {
    undo: async () => {
      if (await videoCommand(Message.RESUME_VIDEO)) notice.show(t('noticeUndone'));
    },
  });
}

function moveNoticeKey(target) {
  if (target === 'always') return 'noticeAddedAlways';
  return target === 'never' ? 'noticeAddedNever' : 'noticeRemovedNever';
}

/** Moves the channel of the video to a list (null: out of both), with an undo. */
async function moveVideoChannel(target) {
  const channel = state.status?.channel;
  if (!channel) return;
  const { settings, undo } = await moveChannel(store, { id: channel.id, name: channel.name }, target);
  state.settings = settings;
  render();
  notice.show(t(moveNoticeKey(target)), {
    undo: async () => {
      state.settings = await undo();
      render();
      notice.show(t('noticeUndone'));
    },
  });
}

/** Excludes the video of the tab for good, or takes it out of the excluded videos, with an undo. */
async function excludeVideo(exclude) {
  const { status } = state;
  if (!status?.videoId) return;
  const video = { videoId: status.videoId, title: status.title, channelName: status.channel?.name ?? '', isShort: status.isShort === true };
  const { settings, undo } = await setVideoExcluded(store, video, exclude);
  state.settings = settings;
  render();
  notice.show(t(exclude ? 'noticeVideoExcluded' : 'noticeVideoUnexcluded'), {
    undo: async () => {
      state.settings = await undo();
      render();
      notice.show(t('noticeUndone'));
    },
  });
}

/**
 * Switches between the video view and the settings view. The settings are
 * the options page itself, loaded in its frame the first time only, so that
 * the popup keeps opening at once.
 */
function showSettings(open) {
  const frame = byId('settings-frame');
  if (open && !frame.getAttribute('src')) frame.src = embeddedOptionsUrl((path) => api.runtime.getURL(path));
  byId('main-view').hidden = open;
  byId('settings-view').hidden = !open;
  const toggle = byId('settings-toggle');
  toggle.setAttribute('aria-expanded', String(open));
  const label = t(open ? 'settingsHide' : 'settingsShow');
  toggle.setAttribute('aria-label', label);
  toggle.title = label;
  (open ? byId('open-full-page') : toggle).focus();
}

const ACTIONS = {
  [Action.LIKE_NOW]: () => videoCommand(Message.LIKE_NOW),
  [Action.SKIP]: skipThisTime,
  [Action.RESUME]: () => videoCommand(Message.RESUME_VIDEO),
  [Action.RESTART]: () => videoCommand(Message.RESTART_VIDEO),
  [Action.RETRY]: () => videoCommand(Message.RESTART_VIDEO),
  [Action.EXCLUDE_VIDEO]: () => excludeVideo(true),
  [Action.UNEXCLUDE_VIDEO]: () => excludeVideo(false),
  [Action.ALWAYS]: () => moveVideoChannel('always'),
  [Action.NEVER]: () => moveVideoChannel('never'),
  [Action.UNLIST_NEVER]: () => moveVideoChannel(null),
};

function listen() {
  byId('enabled').addEventListener('click', () => {
    // The value is decided at the click: a double click asks for it twice
    // instead of switching back.
    const enabled = !state.settings.enabled;
    act(async () => {
      state.settings = await store.updateSettings((settings) => ({ ...settings, enabled }));
      render();
      refresh();
    });
  });
  byId('video-actions').addEventListener('click', (event) => {
    const action = ACTIONS[event.target.closest('button[data-action]')?.dataset.action];
    if (action) act(action);
  });
  byId('settings-toggle').addEventListener('click', () => showSettings(byId('settings-view').hidden));
  byId('open-settings').addEventListener('click', () => showSettings(true));
  byId('open-full-page').addEventListener('click', () => {
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
  store.onUpdateStateChange((update) => {
    state.update = update;
    render();
  });
}

async function start() {
  document.documentElement.lang = lang;
  translatePage(document, t);
  byId('version').textContent = t('versionLabel', [VERSION]);
  try {
    state.settings = await store.loadSettings();
    state.likeCount = await store.loadLikeCount();
    state.update = await store.loadUpdateState();
  } catch (error) {
    console.error(LOG_PREFIX, 'could not load the settings', error);
    notice.show(t('noticeLoadFailed'), { error: true });
    return;
  }
  listen();
  render();
  markReady(document);
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  state.tabId = tab?.id ?? null;
  await refresh();
  setInterval(refresh, REFRESH_MS);
}

start();
