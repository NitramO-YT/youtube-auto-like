/**
 * "My lists" on the options page: the two channel lists in tabs, their
 * search, the removal of a channel, and the export and import of the lists.
 *
 * @param {object} page From index.js: { doc, byId, t, lang, store, notice,
 *   act, confirmChange, state, refresh }; state.settings holds the settings
 *   shown, refresh redraws the page from them.
 */
import { LIST_NAMES, mergeLists } from '../../core/channels.js';
import { ImportError, listsFileName, MAX_LISTS_FILE_BYTES, parseListsFile, serializeLists } from '../../core/lists-file.js';
import { createAvatar, initialOf } from '../shared/avatar.js';
import { el, icon } from '../shared/dom.js';
import { formatNumber, pluralKey } from '../shared/format.js';
import { moveChannel } from '../shared/lists.js';
import { filterChannels } from './fields.js';

const CHANNEL_URL = 'https://www.youtube.com/channel/';

export function createListsSection(page) {
  const { doc, byId, t, lang, store, notice, act, confirmChange, state } = page;
  const dateFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'medium' });
  let tab = 'always';
  let query = '';
  let drawnRows = null;

  function channelRow(channel) {
    const name = channel.name || t('channelUnknown');
    const row = el(doc, 'li', 'row');
    const title = el(doc, 'div', 'title');
    const link = el(doc, 'a', null, name);
    link.href = CHANNEL_URL + channel.id;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = t('listOpenChannel');
    title.append(link);
    if (channel.addedAt) title.append(el(doc, 'span', 'meta', t('listAddedOn', [dateFormat.format(new Date(channel.addedAt))])));
    const remove = el(doc, 'button', 'icon-btn');
    remove.type = 'button';
    remove.dataset.remove = channel.id;
    remove.setAttribute('aria-label', t('listRemove', [name]));
    remove.title = t('listRemove', [name]);
    remove.append(icon(doc, 'close'));
    row.append(createAvatar(doc, { id: channel.id, initial: initialOf(channel.name) }), title, remove);
    return row;
  }

  function render() {
    const { lists } = state.settings;
    for (const name of LIST_NAMES) {
      byId(`count-${name}`).textContent = formatNumber(lists[name].length, lang);
      const button = byId(`tab-${name}`);
      button.setAttribute('aria-selected', String(name === tab));
      button.tabIndex = name === tab ? 0 : -1;
    }
    byId('list-panel').setAttribute('aria-labelledby', `tab-${tab}`);

    const shown = filterChannels(lists[tab], query);
    // Rebuilding up to MAX_CHANNELS rows only when they change.
    const key = JSON.stringify([tab, shown]);
    if (key !== drawnRows) {
      drawnRows = key;
      byId('list-rows').replaceChildren(...shown.map(channelRow));
    }
    const empty = byId('list-empty');
    empty.hidden = shown.length > 0;
    empty.textContent = t(lists[tab].length === 0 ? 'listEmpty' : 'listNoMatch');
  }

  async function removeChannel(channelId) {
    const list = tab;
    const channel = state.settings.lists[list].find((existing) => existing.id === channelId);
    if (!channel) return;
    const buttons = [...byId('list-rows').querySelectorAll('[data-remove]')];
    const index = buttons.findIndex((button) => button.dataset.remove === channelId);
    const { settings, undo } = await moveChannel(store, channel, null);
    state.settings = settings;
    page.refresh();
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
    const link = el(doc, 'a');
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
    page.refresh();
    if (added === 0) {
      notice.show(t('noticeImportedNone'));
      return;
    }
    confirmChange(pluralKey(added, lang, 'noticeImportedOne', 'noticeImportedOther'), [formatNumber(added, lang)], async () => {
      state.settings = await store.updateSettings((current) => ({ ...current, lists: previous }));
    });
  }

  function selectTab(name, focus = false) {
    tab = name;
    render();
    if (focus) byId(`tab-${name}`).focus();
  }

  function listen() {
    for (const name of LIST_NAMES) byId(`tab-${name}`).addEventListener('click', () => selectTab(name));
    byId('tab-always').parentElement.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      selectTab(tab === 'always' ? 'never' : 'always', true);
    });
    byId('list-search').addEventListener('input', (event) => {
      query = event.target.value;
      render();
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
  }

  return { render, listen };
}
