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

export function createHistorySection(page) {
  const { doc, byId, t, lang, store, act, confirmChange } = page;
  const dateTimeFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });
  let history = [];
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
    const key = JSON.stringify(history);
    if (key === drawn) return;
    drawn = key;
    byId('history-rows').replaceChildren(...history.map(row));
    byId('history-empty').hidden = history.length > 0;
    byId('history-clear').disabled = history.length === 0;
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
    store.onHistoryChange((changed) => {
      history = changed;
      render();
    });
  }

  return { start, listen };
}
