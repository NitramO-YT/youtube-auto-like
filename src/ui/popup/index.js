/**
 * Popup of the toolbar icon. While it is open, it asks the liker of the
 * current tab for the status of its video once a second, and offers the
 * on/off switch, the commands for the video and the channel lists.
 *
 * Each part of the popup is redrawn only when what it shows changes, so that
 * a button keeps the keyboard focus while the remaining time ticks.
 */
import './popup.css';
import { listOf } from '../../core/channels.js';
import { availableUpdate, updatesItself } from '../../core/update.js';
import { api } from '../../platform/api.js';
import { Message } from '../../platform/messages.js';
import { createStore } from '../../platform/storage.js';
import { createActionRunner } from '../shared/actions.js';
import { crossFade, markReady, renderParts } from '../shared/dom.js';
import { embeddedOptionsUrl } from '../shared/embed.js';
import { formatLikeCount } from '../shared/format.js';
import { createTranslator, translatePage } from '../shared/i18n.js';
import { directionOf, loadLanguage } from '../shared/locale.js';
import { moveChannel, setVideoExcluded } from '../shared/lists.js';
import { createNotice } from '../shared/notice.js';
import { ruleParts } from '../shared/rule.js';
import { applyTheme } from '../shared/theme.js';
import { listForChoice, moveNoticeKey } from '../shared/channel-choice.js';
import { renderActions, renderCard, renderChannel, renderChannelChoice } from './render.js';
import { Action, channelPageView, videoView } from './view.js';

const REFRESH_MS = 1000;
const LOG_PREFIX = '[YouTube Auto Like]';

// In the language of the browser until start() has read the one of the
// settings, and again in another when the setting changes (changeLanguage).
let t = createTranslator((key, substitutions) => api.i18n.getMessage(key, substitutions));
let lang = t('locale');
const store = createStore(api, { source: 'popup' });
const byId = (id) => document.getElementById(id);

const VERSION = api.runtime.getManifest().version;
const SELF_UPDATING = updatesItself(api.runtime.getManifest());

const state = {
  settings: null,
  tabId: null,
  // undefined until the tab has been asked; null when it did not answer.
  status: undefined,
  likeCount: null,
  update: null,
  // On a video made by several channels, the channel the user picked for the
  // channel choice: { videoId, channelId }, null for the one that publishes it.
  choiceFor: null,
};

/** The channel picked for the choice on the video shown, or null. */
function choiceChannelId() {
  const { choiceFor, status } = state;
  return choiceFor && choiceFor.videoId === status?.videoId ? choiceFor.channelId : null;
}
let refreshing = false;
// The language setting the popup is shown in (or being switched to):
// render() compares it with the settings, whoever changed them.
let shownLanguage = null;

const notice = createNotice(
  { box: byId('notice'), text: byId('notice-text'), undoButton: byId('notice-undo') },
  { run: (action) => act(action) },
);
let act = createActionRunner(notice, t, lang);

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
  if (settings.language !== shownLanguage) changeLanguage(settings.language);

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

  const view = status ? videoView(status, settings, t, lang, Date.now(), choiceChannelId()) : null;
  const page = view ? null : channelPageView(status?.channelPage, settings, t);
  byId('video').hidden = !view;
  byId('channel-page').hidden = !page;
  byId('no-video').hidden = Boolean(view || page) || status === undefined;
  if (page) {
    draw('page-channel', page.channel, (channel) => renderChannel(byId('channel-page-channel'), channel));
    draw('page-choice', { choice: page.choice, channels: null, selected: null }, (model) =>
      renderChannelChoice(byId('channel-page-choice'), model, t),
    );
  }
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
    draw('choice', view.choice, (choice) => renderChannelChoice(byId('video-channel-choice'), choice, t));
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
    const note = byId('update-note');
    link.hidden = !release;
    note.hidden = !release || !SELF_UPDATING;
    byId('version').hidden = Boolean(release);
    if (!release) return;
    link.href = release.url;
    link.textContent = t('updateFooter', [release.version]);
    note.textContent = t('updateInstallsItself');
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

/**
 * Moves the channel shown (of the video, or of the channel page) to a list
 * (null: out of both), with an undo.
 */
/**
 * The channel the choice is for: on a video, the one picked among its
 * channels (by default the one that publishes it); on a channel page, the
 * channel shown.
 */
function choiceChannel() {
  const { status } = state;
  const picked = choiceChannelId();
  return (picked && status?.guests?.find((guest) => guest.id === picked)) || status?.channel || status?.channelPage || null;
}

async function moveShownChannel(target) {
  const channel = choiceChannel();
  if (!channel) return;
  const from = listOf(state.settings.lists, channel.id);
  if (from === target) return;
  const { settings, undo } = await moveChannel(store, { id: channel.id, name: channel.name, avatarUrl: channel.avatarUrl }, target);
  state.settings = settings;
  render();
  notice.show(t(moveNoticeKey(target, from)), {
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
  const video = {
    videoId: status.videoId,
    title: status.title,
    channelId: status.channel?.id ?? null,
    channelName: status.channel?.name ?? '',
    channelAvatarUrl: status.channel?.avatarUrl ?? null,
    isShort: status.isShort === true,
  };
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
  labelSettingsToggle();
  (open ? byId('open-full-page') : byId('settings-toggle')).focus();
}

/** The settings button says what it does now: show the settings, or go back to the video. */
function labelSettingsToggle() {
  const open = !byId('settings-view').hidden;
  const toggle = byId('settings-toggle');
  toggle.setAttribute('aria-expanded', String(open));
  const label = t(open ? 'settingsHide' : 'settingsShow');
  toggle.setAttribute('aria-label', label);
  toggle.title = label;
}

/** Puts the popup in the language t and lang now hold, its fixed texts first. */
function applyLanguage() {
  act = createActionRunner(notice, t, lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = directionOf(lang);
  translatePage(document, t);
  byId('version').textContent = t('versionLabel', [VERSION]);
  labelSettingsToggle();
}

/**
 * Draws the popup again in another language, on the same view, as a
 * cross-fade where the browser can (view transitions). The settings in
 * their frame follow by themselves (options page).
 */
async function changeLanguage(language) {
  shownLanguage = language;
  const loaded = await loadLanguage(api, language);
  // A later change of language wins over this one.
  if (shownLanguage !== language) return;
  crossFade(document, () => {
    ({ t, lang } = loaded);
    applyLanguage();
    drawn.clear();
    render();
  });
}

const ACTIONS = {
  [Action.LIKE_NOW]: () => videoCommand(Message.LIKE_NOW),
  [Action.SKIP]: skipThisTime,
  [Action.RESUME]: () => videoCommand(Message.RESUME_VIDEO),
  [Action.RESTART]: () => videoCommand(Message.RESTART_VIDEO),
  [Action.RETRY]: () => videoCommand(Message.RESTART_VIDEO),
  [Action.EXCLUDE_VIDEO]: () => excludeVideo(true),
  [Action.UNEXCLUDE_VIDEO]: () => excludeVideo(false),
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
  const onChoice = (event) => {
    // The select of a video made by several channels picks the channel; the
    // radio inputs move it.
    if (event.target.name === 'choice-channel') {
      state.choiceFor = { videoId: state.status?.videoId ?? null, channelId: event.target.value };
      render();
      return;
    }
    const target = listForChoice(event.target.value);
    act(async () => {
      try {
        await moveShownChannel(target);
      } finally {
        // The choice shown follows the stored lists, also when the move
        // failed (a full list) and the input checked by the user is wrong.
        drawn.delete('choice');
        drawn.delete('page-choice');
        render();
      }
    });
  };
  byId('video-channel-choice').addEventListener('change', onChoice);
  byId('channel-page-choice').addEventListener('change', onChoice);
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
  try {
    state.settings = await store.loadSettings();
    shownLanguage = state.settings.language;
    ({ t, lang } = await loadLanguage(api, shownLanguage));
  } catch (error) {
    console.error(LOG_PREFIX, 'could not load the settings', error);
    notice.show(t('noticeLoadFailed'), { error: true });
    return;
  }
  applyLanguage();
  try {
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
