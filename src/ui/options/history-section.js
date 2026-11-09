/**
 * "History" on the options page: the likes the extension made, newest first,
 * each linking to its video with the choice for its channel (always, per
 * the settings, never), and the clearing of the history. It follows the
 * likes made while the page is open.
 *
 * @param {object} page From index.js (see lists-section.js).
 */
import { listOf } from '../../core/channels.js';
import { MAX_HISTORY } from '../../core/history.js';
import { videoUrl } from '../../core/video.js';
import { createAvatar, initialOf } from '../shared/avatar.js';
import { ChannelChoice, channelChoice, listForChoice, moveNoticeKey } from '../shared/channel-choice.js';
import { el } from '../shared/dom.js';
import { formatNumber } from '../shared/format.js';
import { moveChannel } from '../shared/lists.js';
import { createPager } from './pager.js';

// Options of the channel choice of a row, in the order shown.
const CHOICE_OPTIONS = [
  [ChannelChoice.AUTO, 'channelChoiceAuto'],
  [ChannelChoice.ALWAYS, 'listAlways'],
  [ChannelChoice.NEVER, 'listNever'],
];

export function createHistorySection(page) {
  const { doc, byId, t, lang, store, act, confirmChange, state } = page;
  const dateTimeFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });
  let history = [];
  let drawn = null;
  const pager = createPager(
    {
      rows: byId('history-rows'),
      row: byId('history-more'),
      count: byId('history-more-count'),
      more: byId('history-more-button'),
      all: byId('history-all-button'),
    },
    { t, lang, redraw: () => render() },
  );

  /** The select of the channel choice of a row, for the channel of entry. */
  function choiceSelect(entry, choice) {
    const select = el(doc, 'select', 'select row-choice');
    select.dataset.videoId = entry.videoId;
    select.setAttribute('aria-label', t('historyChannelChoice', [entry.channelName || t('channelUnknown')]));
    for (const [value, key] of CHOICE_OPTIONS) {
      const option = el(doc, 'option', null, t(key));
      option.value = value;
      option.selected = value === choice;
      select.append(option);
    }
    return select;
  }

  function row(entry, choice) {
    const item = el(doc, 'li', 'row');
    const title = el(doc, 'div', 'title');
    const link = el(doc, 'a', null, entry.title || t('historyUntitled'));
    link.href = videoUrl(entry);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const meta = [entry.channelName, t(entry.isShort ? 'kindShort' : 'kindVideo'), dateTimeFormat.format(new Date(entry.likedAt))];
    title.append(link, el(doc, 'span', 'meta', meta.filter(Boolean).join(' · ')));
    item.append(
      createAvatar(doc, { id: entry.channelId ?? entry.videoId, initial: initialOf(entry.channelName), avatarUrl: entry.channelAvatarUrl }),
      title,
    );
    if (choice) item.append(choiceSelect(entry, choice));
    return item;
  }

  /** The choice for the channel of each entry; null for a like whose channel is unknown. */
  const choicesOf = (entries) =>
    entries.map((entry) => (entry.channelId && state.settings ? channelChoice({ id: entry.channelId }, state.settings) : null));

  async function changeChoice(videoId, choice) {
    const entry = history.find((existing) => existing.videoId === videoId);
    if (!entry?.channelId) return;
    const channel = { id: entry.channelId, name: entry.channelName, avatarUrl: entry.channelAvatarUrl };
    const target = listForChoice(choice);
    const from = listOf(state.settings.lists, channel.id);
    if (from === target) return;
    const { settings, undo } = await moveChannel(store, channel, target);
    state.settings = settings;
    page.refresh();
    confirmChange(moveNoticeKey(target, from), [], async () => {
      state.settings = await undo();
    });
  }

  function render() {
    if (state.settings) pager.setPageSize(state.settings.listPageSize);
    const shown = pager.slice(history);
    const choices = choicesOf(shown);
    const key = JSON.stringify([shown, choices]);
    if (key !== drawn) {
      drawn = key;
      byId('history-rows').replaceChildren(...shown.map((entry, index) => row(entry, choices[index])));
    }
    byId('history-empty').hidden = history.length > 0;
    byId('history-clear').disabled = history.length === 0;
    pager.render(shown.length, history.length);
  }

  async function clear() {
    const previous = await store.loadHistory();
    history = await store.setHistory([]);
    render();
    confirmChange('noticeHistoryCleared', [], async () => {
      history = await store.setHistory(previous);
      render();
    });
  }

  /** Loads the history and shows it; throws when storage cannot be read. */
  async function start() {
    byId('history-hint').textContent = t('historyHint', [formatNumber(MAX_HISTORY, lang)]);
    history = await store.loadHistory();
    render();
  }

  function listen() {
    byId('history-clear').addEventListener('click', () => act(clear));
    byId('history-rows').addEventListener('change', (event) => {
      const select = event.target.closest('select[data-video-id]');
      if (!select) return;
      const { videoId } = select.dataset;
      act(async () => {
        try {
          await changeChoice(videoId, select.value);
        } finally {
          // The rows follow the stored lists, also when the move failed; the
          // select of the row keeps the keyboard focus.
          drawn = null;
          render();
          byId('history-rows').querySelector(`select[data-video-id="${videoId}"]`)?.focus();
        }
      });
    });
    store.onHistoryChange((changed) => {
      history = changed;
      render();
    });
  }

  return { start, listen, render };
}
