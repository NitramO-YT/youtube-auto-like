/**
 * Options page. Every change is saved as soon as it is made, and confirmed
 * by a notice that offers to undo it. The page follows changes made
 * elsewhere (the popup, another options tab) through storage events.
 *
 * This file holds the settings form, the switch and the like count, and puts
 * the page together; the lists, the history and the menu have their own
 * modules, which receive the shared parts as `page`.
 */
import './options.css';
import { AUTO_LANGUAGE, LOCALES } from '../../core/locales.js';
import { api } from '../../platform/api.js';
import { createStore } from '../../platform/storage.js';
import { createActionRunner } from '../shared/actions.js';
import { markReady, renderParts } from '../shared/dom.js';
import { formatLikeCount, formatNumber } from '../shared/format.js';
import { createTranslator, translatePage } from '../shared/i18n.js';
import { directionOf, languageLabel, loadLanguage } from '../shared/locale.js';
import { dialogFromHash, dialogPageUrl, isEmbedded } from '../shared/embed.js';
import { createNotice } from '../shared/notice.js';
import { ruleParts } from '../shared/rule.js';
import { applyTheme } from '../shared/theme.js';
import { createAddDialog } from './add-dialog.js';
import { createExportDialog } from './export-dialog.js';
import { FIELDS, lockedThreshold, NUMBER_RANGES, validNumber } from './fields.js';
import { createHistorySection } from './history-section.js';
import { createImportDialog } from './import-dialog.js';
import { createListsSection } from './lists-section.js';
import { highlightSections } from './menu.js';
import { createReportSection } from './report-section.js';
import { createUpdateSection } from './update-section.js';

const LOG_PREFIX = '[YouTube Auto Like]';

const store = createStore(api);
const byId = (id) => document.getElementById(id);
const form = byId('form');

const state = { settings: null, likeCount: null };

// The texts, in the language of the browser until start() has read the one
// of the settings; the sections, which format dates and numbers in it, are
// made once it is known (setUp).
let t = createTranslator((key, substitutions) => api.i18n.getMessage(key, substitutions));
let lang = t('locale');
let act = null;
let page = null;
let lists = null;
let history = null;
let updates = null;
let report = null;
let dialogs = null;

const notice = createNotice(
  { box: byId('notice'), text: byId('notice-text'), undoButton: byId('notice-undo') },
  { run: (action) => act(action) },
);

/** Shows a notice for a change, whose undo applies revert and confirms it. */
function confirmChange(key, substitutions, revert) {
  notice.show(t(key, substitutions), {
    undo: async () => {
      await revert();
      fill();
      notice.show(t('noticeUndone'));
    },
  });
}

/** Makes the sections and dialogs, in the language t and lang now hold. */
function setUp() {
  act = createActionRunner(notice, t, lang);
  page = {
    doc: document,
    byId,
    t,
    lang,
    store,
    notice,
    act,
    confirmChange,
    state,
    refresh: () => fill(),
    changeField: (field, value) => changeField(field, value),
  };
  lists = createListsSection(page);
  history = createHistorySection(page);
  updates = createUpdateSection(page, api);
  report = createReportSection(page, api);
  dialogs = {
    add: createAddDialog(page),
    import: createImportDialog(page),
    export: createExportDialog(page),
    report: { open: report.open, listen: () => {} },
  };
}

/**
 * The choices of the language: the browser's, then each language as
 * languageLabel shows it, in the alphabetical order of the page language.
 */
function fillLanguages() {
  const select = byId('language');
  const auto = document.createElement('option');
  auto.value = AUTO_LANGUAGE;
  auto.textContent = t('languageAuto');
  const choices = Object.keys(LOCALES).map((code) => ({ code, label: languageLabel(code, lang) }));
  // Sorted on the names, after the flag and its space.
  const name = (label) => label.slice(label.indexOf(' ') + 1);
  choices.sort((a, b) => name(a.label).localeCompare(name(b.label), lang));
  select.replaceChildren(
    auto,
    ...choices.map(({ code, label }) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = label;
      return option;
    }),
  );
}

/**
 * Opens a dialog of the lists. In the frame of the popup, too small for
 * them, the full page opens instead, on the same dialog.
 */
function openDialog(name) {
  if (isEmbedded(window.location)) {
    api.tabs.create({ url: dialogPageUrl((path) => api.runtime.getURL(path), name) }).then(
      () => {},
      (error) => console.error(LOG_PREFIX, 'could not open the options page', error),
    );
    return;
  }
  if (name === 'add') dialogs.add.open(lists.currentList() ?? 'always');
  else dialogs[name].open();
}

function renderCount() {
  byId('like-count').textContent = state.likeCount === null ? '' : formatLikeCount(state.likeCount, lang, t);
  byId('reset-count').disabled = !state.likeCount;
}

/** Draws the page from state.settings. */
function fill() {
  const { settings } = state;
  if (!settings) return;
  applyTheme(document, settings.theme, window.localStorage);
  const paused = !settings.enabled;
  document.body.classList.toggle('paused', paused);
  byId('paused-banner').hidden = !paused;
  const toggle = byId('enabled');
  toggle.disabled = false;
  toggle.setAttribute('aria-checked', String(!paused));
  byId('enabled-state').textContent = t(paused ? 'switchPaused' : 'switchActive');

  for (const input of form.querySelectorAll('[data-field]')) {
    const value = FIELDS[input.dataset.field].get(settings);
    if (input.type === 'radio') input.checked = input.value === value;
    else if (input.type === 'checkbox') input.checked = value;
    else input.value = String(value);
  }
  for (const range of form.querySelectorAll('[data-mirror]')) {
    range.value = String(FIELDS[range.dataset.mirror].get(settings));
  }

  const { mode } = settings.timing;
  byId('delays').hidden = mode !== 'custom';
  byId('random-hint').hidden = mode !== 'random';
  const locked = lockedThreshold(settings.timing);
  byId('percent-enabled').disabled = locked === 'percent';
  byId('minutes-enabled').disabled = locked === 'minutes';
  byId('threshold-lock').hidden = !locked;
  renderParts(byId('summary'), ruleParts(settings, t, lang));
  lists.render();
  history.render();
  updates.render();
  report.render();
}

async function changeField(field, value) {
  let previous;
  state.settings = await store.updateSettings((current) => {
    previous = FIELDS[field].get(current);
    return FIELDS[field].set(current, value);
  });
  fill();
  confirmChange('noticeSaved', [], async () => {
    state.settings = await store.updateSettings((current) => FIELDS[field].set(current, previous));
  });
}

/** The value of a form input, or null (with a notice) for an invalid number. */
function inputValue(input, field) {
  if (input.type === 'radio') return input.value;
  if (input.type === 'checkbox') return input.checked;
  if (input.tagName === 'SELECT') {
    // Choices are numbers (rows shown) or words (languages).
    return FIELDS[field].choices.find((choice) => String(choice) === input.value) ?? null;
  }
  const range = NUMBER_RANGES[field];
  const value = validNumber(input.valueAsNumber, range);
  if (value === null) {
    notice.show(t('noticeNumberInvalid', [formatNumber(range.min, lang), formatNumber(range.max, lang)]), { error: true });
    fill();
  }
  return value;
}

async function resetCount() {
  const previous = await store.loadLikeCount();
  state.likeCount = await store.setLikeCount(0);
  renderCount();
  confirmChange('noticeCountReset', [], async () => {
    state.likeCount = await store.setLikeCount(previous);
    renderCount();
  });
}

function listen() {
  // The value is decided at the click: a double click asks for it twice
  // instead of switching back.
  byId('enabled').addEventListener('click', () => {
    const enabled = !state.settings.enabled;
    act(() => changeField('enabled', enabled));
  });
  form.addEventListener('change', (event) => {
    const input = event.target;
    const field = input.dataset.field ?? input.dataset.mirror;
    if (!FIELDS[field]) return;
    const value = inputValue(input, field);
    if (value !== null) act(() => changeField(field, value));
  });
  form.addEventListener('input', (event) => {
    const range = event.target.closest('[data-mirror]');
    if (range) form.querySelector(`[data-field="${range.dataset.mirror}"]`).value = range.value;
  });
  byId('reset-count').addEventListener('click', () => act(resetCount));
  document.addEventListener('click', (event) => {
    const name = event.target.closest('[data-dialog]')?.dataset.dialog;
    if (name && Object.hasOwn(dialogs, name)) openDialog(name);
  });
  lists.listen();
  history.listen();
  updates.listen();
  report.listen();
  for (const dialog of Object.values(dialogs)) dialog.listen();

  store.onSettingsChange((settings) => {
    // Another language: the page is drawn again in it, from the start.
    if (settings.language !== state.settings.language) {
      window.location.reload();
      return;
    }
    state.settings = settings;
    fill();
  });
  store.onLikeCountChange((count) => {
    state.likeCount = count;
    renderCount();
  });
}

async function start() {
  try {
    state.settings = await store.loadSettings();
    ({ t, lang } = await loadLanguage(api, state.settings.language));
  } catch (error) {
    console.error(LOG_PREFIX, 'could not load the settings', error);
    notice.show(t('noticeLoadFailed'), { error: true });
    return;
  }
  setUp();
  document.documentElement.lang = lang;
  document.documentElement.dir = directionOf(lang);
  translatePage(document, t);
  fillLanguages();
  try {
    state.likeCount = await store.loadLikeCount();
    await history.start();
    await updates.start();
    await report.start();
  } catch (error) {
    console.error(LOG_PREFIX, 'could not load the settings', error);
    notice.show(t('noticeLoadFailed'), { error: true });
    return;
  }
  fill();
  renderCount();
  markReady(document);
  listen();
  highlightSections(window, byId('nav'), [...form.querySelectorAll('section')]);
  // Opened from the popup on a dialog (dialogPageUrl): the dialog shows at
  // once, and the address goes back to the page alone.
  const asked = dialogFromHash(window.location.hash);
  if (asked) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    openDialog(asked);
  }
}

start();
