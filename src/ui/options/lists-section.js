/**
 * "My lists" on the options page, in three tabs: the two channel lists and
 * the excluded videos. Each tab has its search and its removal with undo;
 * the export and import cover all three.
 *
 * @param {object} page From index.js: { doc, byId, t, lang, store, notice,
 *   act, confirmChange, state, refresh }; state.settings holds the settings
 *   shown, refresh redraws the page from them.
 */
import { mergeLists } from '../../core/channels.js';
import { mergeExcludedVideos } from '../../core/excluded-videos.js';
import { videoUrl } from '../../core/video.js';
import { ImportError, listsFileName, MAX_LISTS_FILE_BYTES, parseListsFile, serializeLists } from '../../core/lists-file.js';
import { createAvatar, initialOf } from '../shared/avatar.js';
import { el, icon } from '../shared/dom.js';
import { formatNumber, pluralKey } from '../shared/format.js';
import { moveChannel, setVideoExcluded } from '../shared/lists.js';
import { filterChannels, filterVideos } from './fields.js';
import { PAGE_SIZE, renderMore } from './pager.js';

const CHANNEL_URL = 'https://www.youtube.com/channel/';
const TAB_NAMES = ['always', 'never', 'videos'];

export function createListsSection(page) {
  const { doc, byId, t, lang, store, notice, act, confirmChange, state } = page;
  const dateFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'medium' });
  let tab = 'always';
  let query = '';
  // How many entries of the tab are shown (see pager.js); back to one page
  // on another tab or another search.
  let limit = PAGE_SIZE;
  let drawnRows = null;

  function row({ id, avatar, name, href, linkTitle, meta, removeLabel }) {
    const item = el(doc, 'li', 'row');
    const title = el(doc, 'div', 'title');
    const link = el(doc, 'a', null, name);
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (linkTitle) link.title = linkTitle;
    title.append(link);
    if (meta) title.append(el(doc, 'span', 'meta', meta));
    const remove = el(doc, 'button', 'icon-btn');
    remove.type = 'button';
    remove.dataset.remove = id;
    remove.setAttribute('aria-label', removeLabel);
    remove.title = removeLabel;
    remove.append(icon(doc, 'close'));
    item.append(createAvatar(doc, avatar), title, remove);
    return item;
  }

  const channelTab = (list) => ({
    entries: () => state.settings.lists[list],
    filter: filterChannels,
    idOf: (channel) => channel.id,
    row: (channel) => {
      const name = channel.name || t('channelUnknown');
      return row({
        id: channel.id,
        avatar: { id: channel.id, initial: initialOf(channel.name) },
        name,
        href: CHANNEL_URL + channel.id,
        linkTitle: t('listOpenChannel'),
        meta: channel.addedAt ? t('listAddedOn', [dateFormat.format(new Date(channel.addedAt))]) : '',
        removeLabel: t('listRemove', [name]),
      });
    },
    remove: async (channel) => {
      const { settings, undo } = await moveChannel(store, channel, null);
      return { settings, undo, noticeKey: list === 'always' ? 'noticeRemovedAlways' : 'noticeRemovedNever' };
    },
  });

  const TABS = {
    always: channelTab('always'),
    never: channelTab('never'),
    videos: {
      entries: () => state.settings.excludedVideos,
      filter: filterVideos,
      idOf: (video) => video.videoId,
      row: (video) => {
        const name = video.title || t('historyUntitled');
        const added = video.addedAt ? t('listExcludedOn', [dateFormat.format(new Date(video.addedAt))]) : '';
        return row({
          id: video.videoId,
          avatar: { id: video.videoId, initial: initialOf(video.channelName) },
          name,
          href: videoUrl(video),
          meta: [video.channelName, t(video.isShort ? 'kindShort' : 'kindVideo'), added].filter(Boolean).join(' · '),
          removeLabel: t('listUnexclude', [name]),
        });
      },
      remove: async (video) => {
        const { settings, undo } = await setVideoExcluded(store, video, false);
        return { settings, undo, noticeKey: 'noticeVideoUnexcluded' };
      },
    },
  };

  function render() {
    for (const name of TAB_NAMES) {
      byId(`count-${name}`).textContent = formatNumber(TABS[name].entries().length, lang);
      const button = byId(`tab-${name}`);
      button.setAttribute('aria-selected', String(name === tab));
      button.tabIndex = name === tab ? 0 : -1;
    }
    byId('list-panel').setAttribute('aria-labelledby', `tab-${tab}`);

    const current = TABS[tab];
    const found = current.filter(current.entries(), query);
    const shown = found.slice(0, limit);
    // Rebuilding the rows only when they change.
    const key = JSON.stringify([tab, shown]);
    if (key !== drawnRows) {
      drawnRows = key;
      byId('list-rows').replaceChildren(...shown.map(current.row));
    }
    const empty = byId('list-empty');
    empty.hidden = found.length > 0;
    empty.textContent = t(current.entries().length === 0 ? 'listEmpty' : 'listNoMatch');
    renderMore({ row: byId('list-more'), count: byId('list-more-count'), button: byId('list-more-button') }, shown.length, found.length, t, lang);
  }

  async function remove(id) {
    const current = TABS[tab];
    const entry = current.entries().find((existing) => current.idOf(existing) === id);
    if (!entry) return;
    const buttons = [...byId('list-rows').querySelectorAll('[data-remove]')];
    const index = buttons.findIndex((button) => button.dataset.remove === id);
    const { settings, undo, noticeKey } = await current.remove(entry);
    state.settings = settings;
    page.refresh();
    // The focus goes to the row that took its place, so that a keyboard user
    // can go on removing.
    const remaining = byId('list-rows').querySelectorAll('[data-remove]');
    (remaining[index] ?? remaining[index - 1] ?? byId('list-search')).focus();
    confirmChange(noticeKey, [], async () => {
      state.settings = await undo();
    });
  }

  function exportLists() {
    const now = new Date();
    const text = serializeLists(state.settings.lists, state.settings.excludedVideos, now.toISOString());
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
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
      previous = { lists: current.lists, excludedVideos: current.excludedVideos };
      const channels = mergeLists(current.lists, result.lists, new Date().toISOString());
      const videos = mergeExcludedVideos(current.excludedVideos, result.excludedVideos);
      added = channels.added + videos.added;
      return { ...current, lists: channels.lists, excludedVideos: videos.videos };
    });
    page.refresh();
    if (added === 0) {
      notice.show(t('noticeImportedNone'));
      return;
    }
    confirmChange(pluralKey(added, lang, 'noticeImportedOne', 'noticeImportedOther'), [formatNumber(added, lang)], async () => {
      state.settings = await store.updateSettings((current) => ({ ...current, ...previous }));
    });
  }

  function selectTab(name, focus = false) {
    tab = name;
    limit = PAGE_SIZE;
    render();
    if (focus) byId(`tab-${name}`).focus();
  }

  function listen() {
    for (const name of TAB_NAMES) byId(`tab-${name}`).addEventListener('click', () => selectTab(name));
    byId('tab-always').parentElement.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      selectTab(TAB_NAMES[(TAB_NAMES.indexOf(tab) + step + TAB_NAMES.length) % TAB_NAMES.length], true);
    });
    byId('list-search').addEventListener('input', (event) => {
      query = event.target.value;
      limit = PAGE_SIZE;
      render();
    });
    byId('list-more-button').addEventListener('click', () => {
      limit += PAGE_SIZE;
      render();
    });
    byId('list-rows').addEventListener('click', (event) => {
      const id = event.target.closest('[data-remove]')?.dataset.remove;
      if (id) act(() => remove(id));
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
