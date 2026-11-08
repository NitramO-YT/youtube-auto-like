/**
 * "History" on the options page: the likes the extension made, newest first,
 * each linking to its video, and the clearing of the history. It follows the
 * likes made while the page is open.
 *
 * @param {object} page From index.js (see lists-section.js).
 */
import { MAX_HISTORY } from '../../core/history.js';
import { videoUrl } from '../../core/video.js';
import { createAvatar, initialOf } from '../shared/avatar.js';
import { el } from '../shared/dom.js';
import { formatNumber } from '../shared/format.js';
import { PAGE_SIZE, renderMore } from './pager.js';

export function createHistorySection(page) {
  const { doc, byId, t, lang, store, act, confirmChange } = page;
  const dateTimeFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });
  let history = [];
  // How many likes are shown (see pager.js).
  let limit = PAGE_SIZE;
  let drawn = null;

  function row(entry) {
    const item = el(doc, 'li', 'row');
    const title = el(doc, 'div', 'title');
    const link = el(doc, 'a', null, entry.title || t('historyUntitled'));
    link.href = videoUrl(entry);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const meta = [entry.channelName, t(entry.isShort ? 'kindShort' : 'kindVideo'), dateTimeFormat.format(new Date(entry.likedAt))];
    title.append(link, el(doc, 'span', 'meta', meta.filter(Boolean).join(' · ')));
    item.append(createAvatar(doc, { id: entry.channelId ?? entry.videoId, initial: initialOf(entry.channelName) }), title);
    return item;
  }

  function render() {
    const shown = history.slice(0, limit);
    const key = JSON.stringify(shown);
    if (key !== drawn) {
      drawn = key;
      byId('history-rows').replaceChildren(...shown.map(row));
    }
    byId('history-empty').hidden = history.length > 0;
    byId('history-clear').disabled = history.length === 0;
    renderMore({ row: byId('history-more'), count: byId('history-more-count'), button: byId('history-more-button') }, shown.length, history.length, t, lang);
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
    byId('history-more-button').addEventListener('click', () => {
      limit += PAGE_SIZE;
      render();
    });
    store.onHistoryChange((changed) => {
      history = changed;
      render();
    });
  }

  return { start, listen };
}
