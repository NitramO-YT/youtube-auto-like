/**
 * Options page. Every change is saved as soon as it is made, and confirmed
 * by a notice that offers to undo it. The page follows changes made
 * elsewhere (the popup, another options tab) through storage events.
 */
import './options.css';
import { LIST_NAMES, mergeLists } from '../../core/channels.js';
import { ImportError, listsFileName, MAX_LISTS_FILE_BYTES, parseListsFile, serializeLists } from '../../core/lists-file.js';
import { api } from '../../platform/api.js';
import { createStore } from '../../platform/storage.js';
import { createActionRunner } from '../shared/actions.js';
import { createAvatar, initialOf } from '../shared/avatar.js';
import { el, icon, markReady, renderParts } from '../shared/dom.js';
import { formatLikeCount, formatNumber, pluralKey } from '../shared/format.js';
import { createTranslator, translatePage } from '../shared/i18n.js';
import { moveChannel } from '../shared/lists.js';
import { createNotice } from '../shared/notice.js';
import { ruleParts } from '../shared/rule.js';
import { applyTheme } from '../shared/theme.js';
import { FIELDS, filterChannels, lockedThreshold, NUMBER_RANGES, validNumber } from './fields.js';
import { currentSection } from './sections.js';

const LOG_PREFIX = '[YouTube Auto Like]';
const CHANNEL_URL = 'https://www.youtube.com/channel/';

const t = createTranslator((key, substitutions) => api.i18n.getMessage(key, substitutions));
const lang = t('locale');
const store = createStore(api);
const byId = (id) => document.getElementById(id);
const form = byId('form');
const dateFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'medium' });

const state = { settings: null, likeCount: null, tab: 'always', query: '' };

const notice = createNotice(
  { box: byId('notice'), text: byId('notice-text'), undoButton: byId('notice-undo') },
  { run: (action) => act(action) },
);
const act = createActionRunner(notice, t, lang);

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

// ---- Drawing the page from the settings ----

let drawnRows = null;

function channelRow(channel) {
  const name = channel.name || t('channelUnknown');
  const row = el(document, 'li', 'row');
  const title = el(document, 'div', 'title');
  const link = el(document, 'a', null, name);
  link.href = CHANNEL_URL + channel.id;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.title = t('listOpenChannel');
  title.append(link);
  if (channel.addedAt) title.append(el(document, 'span', 'meta', t('listAddedOn', [dateFormat.format(new Date(channel.addedAt))])));
  const remove = el(document, 'button', 'icon-btn');
  remove.type = 'button';
  remove.dataset.remove = channel.id;
  remove.setAttribute('aria-label', t('listRemove', [name]));
  remove.title = t('listRemove', [name]);
  remove.append(icon(document, 'close'));
  row.append(createAvatar(document, { id: channel.id, initial: initialOf(channel.name) }), title, remove);
  return row;
}

function renderLists() {
  const { lists } = state.settings;
  for (const name of LIST_NAMES) {
    byId(`count-${name}`).textContent = formatNumber(lists[name].length, lang);
    const tab = byId(`tab-${name}`);
    tab.setAttribute('aria-selected', String(name === state.tab));
    tab.tabIndex = name === state.tab ? 0 : -1;
  }
  byId('list-panel').setAttribute('aria-labelledby', `tab-${state.tab}`);

  const shown = filterChannels(lists[state.tab], state.query);
  // Rebuilding up to MAX_CHANNELS rows only when they change.
  const key = JSON.stringify([state.tab, shown]);
  if (key !== drawnRows) {
    drawnRows = key;
    byId('list-rows').replaceChildren(...shown.map(channelRow));
  }
  const empty = byId('list-empty');
  empty.hidden = shown.length > 0;
  empty.textContent = t(lists[state.tab].length === 0 ? 'listEmpty' : 'listNoMatch');
}

function renderCount() {
  byId('like-count').textContent = state.likeCount === null ? '' : formatLikeCount(state.likeCount, lang, t);
  byId('reset-count').disabled = !state.likeCount;
}

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
  renderLists();
}

// ---- Changes ----

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
  const range = NUMBER_RANGES[field];
  const value = validNumber(input.valueAsNumber, range);
  if (value === null) {
    notice.show(t('noticeNumberInvalid', [formatNumber(range.min, lang), formatNumber(range.max, lang)]), { error: true });
    fill();
  }
  return value;
}

async function removeChannel(channelId) {
  const list = state.tab;
  const channel = state.settings.lists[list].find((existing) => existing.id === channelId);
  if (!channel) return;
  const buttons = [...byId('list-rows').querySelectorAll('[data-remove]')];
  const index = buttons.findIndex((button) => button.dataset.remove === channelId);
  const { settings, undo } = await moveChannel(store, channel, null);
  state.settings = settings;
  fill();
  // The focus goes to the row that took its place, so that a keyboard user
  // can go on removing.
  const remaining = byId('list-rows').querySelectorAll('[data-remove]');
  (remaining[index] ?? remaining[index - 1] ?? byId('list-search')).focus();
  confirmChange(list === 'always' ? 'noticeRemovedAlways' : 'noticeRemovedNever', [], async () => {
    state.settings = await undo();
  });
}

function exportLists() {
  const now = new Date();
  const blob = new Blob([serializeLists(state.settings.lists, now.toISOString())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = el(document, 'a');
  link.href = url;
  link.download = listsFileName(now);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function importLists(file) {
  // A file too large is refused before being read.
  const text = file.size > MAX_LISTS_FILE_BYTES ? '' : await file.text();
  const result = parseListsFile(text, file.size);
  if (result.error) {
    notice.show(t(result.error === ImportError.TOO_BIG ? 'noticeImportTooBig' : 'noticeImportInvalid'), { error: true });
    return;
  }
  let previous;
  let added = 0;
  state.settings = await store.updateSettings((current) => {
    previous = current.lists;
    const merged = mergeLists(current.lists, result.lists, new Date().toISOString());
    added = merged.added;
    return { ...current, lists: merged.lists };
  });
  fill();
  if (added === 0) {
    notice.show(t('noticeImportedNone'));
    return;
  }
  confirmChange(pluralKey(added, lang, 'noticeImportedOne', 'noticeImportedOther'), [formatNumber(added, lang)], async () => {
    state.settings = await store.updateSettings((current) => ({ ...current, lists: previous }));
  });
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

function selectTab(name, focus = false) {
  state.tab = name;
  renderLists();
  if (focus) byId(`tab-${name}`).focus();
}

// ---- Wiring ----

// Height under which a section counts as read at the top of the page: the
// sticky header, and a little margin.
const SECTION_OFFSET_PX = 120;
// User input that may scroll the page, and so ends a choice made in the menu.
const SCROLL_INPUTS = ['wheel', 'touchstart', 'keydown'];

/**
 * Marks in the menu the section being read (see sections.js). A section
 * chosen in the menu stays marked until the user scrolls again, even when
 * the page cannot scroll far enough to bring it to the reading line.
 */
function highlightSections() {
  const links = [...byId('nav').querySelectorAll('a')];
  const sections = [...form.querySelectorAll('section')];
  let chosen = null;
  const mark = (id) => {
    for (const link of links) link.setAttribute('aria-current', String(link.hash === `#${id}`));
  };
  // Browsers fire scroll at most once per frame, and the update reads the
  // position of five sections: it runs on each scroll event as it comes.
  const update = () => {
    if (chosen) return;
    const index = currentSection(
      sections.map((section) => section.getBoundingClientRect().top),
      {
        scrollY: window.scrollY,
        scrollMax: document.documentElement.scrollHeight - window.innerHeight,
        height: window.innerHeight,
        offset: SECTION_OFFSET_PX,
      },
    );
    mark(sections[index].id);
  };
  byId('nav').addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    chosen = link.hash.slice(1);
    mark(chosen);
  });
  for (const type of SCROLL_INPUTS) {
    window.addEventListener(type, () => (chosen = null), { passive: true, capture: true });
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function listen() {
  byId('enabled').addEventListener('click', () => act(() => changeField('enabled', !state.settings.enabled)));

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

  for (const name of LIST_NAMES) byId(`tab-${name}`).addEventListener('click', () => selectTab(name));
  byId('tab-always').parentElement.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    selectTab(state.tab === 'always' ? 'never' : 'always', true);
  });
  byId('list-search').addEventListener('input', (event) => {
    state.query = event.target.value;
    renderLists();
  });
  byId('list-rows').addEventListener('click', (event) => {
    const channelId = event.target.closest('[data-remove]')?.dataset.remove;
    if (channelId) act(() => removeChannel(channelId));
  });
  byId('export').addEventListener('click', exportLists);
  byId('import').addEventListener('click', () => byId('import-file').click());
  byId('import-file').addEventListener('change', (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (file) act(() => importLists(file));
  });
  byId('reset-count').addEventListener('click', () => act(resetCount));

  store.onSettingsChange((settings) => {
    state.settings = settings;
    fill();
  });
  store.onLikeCountChange((count) => {
    state.likeCount = count;
    renderCount();
  });
}

async function start() {
  document.documentElement.lang = lang;
  translatePage(document, t);
  try {
    state.settings = await store.loadSettings();
    state.likeCount = await store.loadLikeCount();
  } catch (error) {
    console.error(LOG_PREFIX, 'could not load the settings', error);
    notice.show(t('noticeLoadFailed'), { error: true });
    return;
  }
  fill();
  renderCount();
  markReady(document);
  listen();
  highlightSections();
}

start();
