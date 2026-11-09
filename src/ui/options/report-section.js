/**
 * What helps report a problem: the journal of the debug mode (in "More":
 * its size, show, copy and clear), the "About" section (version, credits,
 * the repository) and the "Report a problem" dialog, which shows the report
 * (core/report.js) before the user copies it or opens an issue with it.
 *
 * The journal goes into the report only while its box is checked; the box
 * starts checked when the journal holds something, and the dialog says so,
 * the journal naming the videos watched and the channels of the lists.
 *
 * @param {object} page From index.js (see lists-section.js).
 * @param {object} api The extension API, for the version and the browser.
 */
import { journalText } from '../../core/journal.js';
import { issueUrl, reportText, REPOSITORY_URL } from '../../core/report.js';
import { videoUrl } from '../../core/video.js';
import { el } from '../shared/dom.js';
import { formatNumber, formatterFor, pluralKey } from '../shared/format.js';
import { setStatus, setUpDialog } from './dialog.js';

// Under this distance from its bottom, the journal shown counts as read to
// its end, and follows the entries added.
const AT_END_PX = 8;

export function createReportSection(page, api) {
  const { byId, t, store, act, confirmChange, state } = page;
  const version = api.runtime.getManifest().version;
  const dialog = setUpDialog(byId('report-dialog'));
  const timeFormat = formatterFor(() => page.lang, { dateStyle: 'short', timeStyle: 'medium' });
  let journal = [];
  let shown = false;

  /** One entry: its local time, the video as a link, the text in English, the language of the reports. */
  function entryLine({ at, videoId, text }) {
    const line = el(document, 'li', 'journal-line');
    const time = el(document, 'time', null, timeFormat.format(new Date(at)));
    time.dateTime = at;
    // The time is written in the language of the page, which may read from
    // right to left inside the left-to-right journal.
    time.dir = 'auto';
    line.append(time);
    if (videoId) {
      const link = el(document, 'a', null, videoId);
      link.href = videoUrl({ videoId, isShort: false });
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      line.append(link);
    }
    const words = el(document, 'span', null, text);
    words.lang = 'en';
    line.append(words);
    return line;
  }

  /** The journal unfolded under its row, oldest first as copied; kept at its end while read there. */
  function renderView() {
    const view = byId('journal-view');
    // An emptied journal folds: the next entries do not unfold it by themselves.
    if (journal.length === 0) shown = false;
    const visible = shown && !byId('journal-row').hidden;
    const toggle = byId('journal-toggle');
    toggle.textContent = t(visible ? 'journalHide' : 'journalShow');
    toggle.setAttribute('aria-expanded', String(visible));
    toggle.disabled = journal.length === 0;
    view.hidden = !visible;
    if (!visible) {
      view.replaceChildren();
      return;
    }
    const atEnd = view.childElementCount === 0 || view.scrollHeight - view.scrollTop - view.clientHeight < AT_END_PX;
    view.replaceChildren(...journal.map(entryLine));
    if (atEnd) view.scrollTop = view.scrollHeight;
  }

  function render() {
    const debug = state.settings?.debug ?? false;
    byId('journal-row').hidden = !debug && journal.length === 0;
    byId('journal-count').textContent = t(pluralKey(journal.length, page.lang,'journalCountOne', 'journalCountOther'), [formatNumber(journal.length, page.lang)]);
    byId('journal-copy').disabled = journal.length === 0;
    byId('journal-clear').disabled = journal.length === 0;
    renderView();
  }

  /** Puts a text in the clipboard; false when the browser refuses. */
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function copyJournal() {
    page.notice.show(t((await copy(journalText(journal))) ? 'noticeCopied' : 'noticeCopyFailed'), { error: false });
  }

  async function clearJournal() {
    const previous = journal;
    journal = await store.setJournal([]);
    render();
    confirmChange('noticeJournalCleared', [], async () => {
      journal = await store.setJournal(previous);
      render();
    });
  }

  function showReport() {
    const included = byId('report-journal').checked;
    const text = reportText({ version, userAgent: navigator.userAgent, settings: state.settings, journal: included ? journal : null });
    byId('report-text').value = text;
    const { url, cut } = issueUrl(text);
    byId('report-issue').href = url;
    setStatus(byId('report-status'), cut ? t('reportCut') : null);
  }

  /** Opens the report, with the journal in it when there is one. */
  function open() {
    const box = byId('report-journal');
    box.checked = journal.length > 0;
    box.disabled = journal.length === 0;
    byId('report-journal-label').textContent = t(pluralKey(journal.length, page.lang,'reportJournalOne', 'reportJournalOther'), [formatNumber(journal.length, page.lang)]);
    byId('report-debug-off').hidden = state.settings.debug || journal.length > 0;
    showReport();
    dialog.open();
    byId('report-copy').focus();
  }

  /** Loads the journal; throws when storage cannot be read. */
  async function start() {
    byId('about-version').textContent = t('aboutVersion', [version]);
    byId('about-repository').href = REPOSITORY_URL;
    byId('about-license').href = `${REPOSITORY_URL}/blob/main/LICENSE`;
    journal = await store.loadJournal();
    render();
  }

  function listen() {
    byId('journal-toggle').addEventListener('click', () => {
      shown = !shown;
      renderView();
    });
    byId('journal-copy').addEventListener('click', () => act(copyJournal));
    byId('journal-clear').addEventListener('click', () => act(clearJournal));
    byId('report-journal').addEventListener('change', showReport);
    byId('report-copy').addEventListener('click', () =>
      act(async () => {
        const copied = await copy(byId('report-text').value);
        setStatus(byId('report-status'), t(copied ? 'noticeCopied' : 'noticeCopyFailed'), { error: !copied });
      }),
    );
    store.onJournalChange((changed) => {
      journal = changed;
      render();
    });
  }

  return { start, listen, render, open };
}
