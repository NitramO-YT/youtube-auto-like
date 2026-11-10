/**
 * "My lists" on the options page, in three tabs: the two channel lists and
 * the excluded videos. Each tab has its search, the order of the listSort
 * setting, and its removal with undo.
 * Adding channels, the import and the export are dialogs of their own
 * (add-dialog.js, import-dialog.js, export-dialog.js), opened by the buttons
 * carrying data-dialog (see index.js).
 *
 * @param {object} page From index.js: { doc, byId, t, lang, store, notice,
 *   act, confirmChange, state, refresh }; state.settings holds the settings
 *   shown, refresh redraws the page from them. t, lang and act always hold
 *   the current language: read lang when drawing, not once.
 */
import { LinkKind, channelPageUrl } from '../../core/channel-links.js';
import { videoUrl } from '../../core/video.js';
import { createAvatar, initialOf } from '../shared/avatar.js';
import { el, icon, joinedParts } from '../shared/dom.js';
import { formatNumber, formatterFor } from '../shared/format.js';
import { moveChannel, setVideoExcluded } from '../shared/lists.js';
import { channelPart } from './channel-link.js';
import { filterChannels, filterVideos, sortEntries } from './fields.js';
import { createPager } from './pager.js';

const TAB_NAMES = ['always', 'never', 'videos'];

export function createListsSection(page) {
  const { doc, byId, t, store, act, confirmChange, state } = page;
  const dateFormat = formatterFor(() => page.lang, { dateStyle: 'medium' });
  let tab = 'always';
  let query = '';
  let drawnRows = null;
  // Back to the first page on another tab or another search.
  const pager = createPager(
    { rows: byId('list-rows'), row: byId('list-more'), count: byId('list-more-count'), more: byId('list-more-button'), all: byId('list-all-button') },
    { locale: page, redraw: () => render() },
  );

  function row({ id, avatar, name, href, linkTitle, meta, removeLabel }) {
    const item = el(doc, 'li', 'row');
    const title = el(doc, 'div', 'title');
    const link = el(doc, 'a', null, name);
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (linkTitle) link.title = linkTitle;
    title.append(link);
    const parts = meta.filter(Boolean);
    if (parts.length > 0) title.append(joinedParts(doc, 'span', 'meta', parts));
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
    emptyKey: 'listEmpty',
    entries: () => state.settings.lists[list],
    filter: filterChannels,
    nameOf: (channel) => channel.name,
    addedOf: (channel) => channel.addedAt,
    idOf: (channel) => channel.id,
    row: (channel) => {
      const name = channel.name || t('channelUnknown');
      return row({
        id: channel.id,
        avatar: { id: channel.id, initial: initialOf(channel.name), avatarUrl: channel.avatarUrl },
        name,
        href: channelPageUrl({ kind: LinkKind.CHANNEL_ID, channelId: channel.id }),
        linkTitle: t('listOpenChannel'),
        meta: [channel.addedAt ? t('listAddedOn', [dateFormat.format(new Date(channel.addedAt))]) : null],
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
      emptyKey: 'listEmptyVideos',
      entries: () => state.settings.excludedVideos,
      filter: filterVideos,
      nameOf: (video) => video.title,
      addedOf: (video) => video.addedAt,
      idOf: (video) => video.videoId,
      row: (video) => {
        const name = video.title || t('historyUntitled');
        const added = video.addedAt ? t('listExcludedOn', [dateFormat.format(new Date(video.addedAt))]) : '';
        return row({
          id: video.videoId,
          avatar: { id: video.channelId ?? video.videoId, initial: initialOf(video.channelName), avatarUrl: video.channelAvatarUrl },
          name,
          href: videoUrl(video),
          meta: [channelPart(doc, video), t(video.isShort ? 'kindShort' : 'kindVideo'), added],
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
      byId(`count-${name}`).textContent = formatNumber(TABS[name].entries().length, page.lang);
      const button = byId(`tab-${name}`);
      button.setAttribute('aria-selected', String(name === tab));
      button.tabIndex = name === tab ? 0 : -1;
    }
    byId('list-panel').setAttribute('aria-labelledby', `tab-${tab}`);

    const current = TABS[tab];
    const found = sortEntries(current.filter(current.entries(), query), state.settings.listSort, current, page.lang);
    pager.setPageSize(state.settings.listPageSize);
    const shown = pager.slice(found);
    // Rebuilding the rows only when they change.
    const key = JSON.stringify([tab, shown]);
    if (key !== drawnRows) {
      drawnRows = key;
      byId('list-rows').replaceChildren(...shown.map(current.row));
    }
    const isEmpty = current.entries().length === 0;
    byId('list-empty').hidden = found.length > 0;
    byId('list-empty-text').textContent = t(isEmpty ? current.emptyKey : 'listNoMatch');
    // Channels are added to the two channel lists; a video is excluded from the popup.
    byId('list-empty-add').hidden = !isEmpty || tab === 'videos';
    byId('add-channels').hidden = tab === 'videos';
    pager.render(shown.length, found.length);
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

  function selectTab(name, focus = false) {
    tab = name;
    pager.reset();
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
      pager.reset();
      render();
    });
    byId('list-rows').addEventListener('click', (event) => {
      const id = event.target.closest('[data-remove]')?.dataset.remove;
      if (id) act(() => remove(id));
    });
  }

  /** The channel list of the tab shown ('always' or 'never'), the list "Add channels" fills; null on the videos tab. */
  const currentList = () => (tab === 'videos' ? null : tab);

  return { render, listen, currentList };
}
