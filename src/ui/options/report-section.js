/**
 * What helps report a problem: the journal of the debug mode (in "More":
 * its size, copy and clear), the "About" section (version, credits, the
 * repository) and the "Report a problem" dialog, which shows the report
 * (core/report.js) before the user copies it or opens an issue with it.
 *
 * The journal goes into the report only while its box is checked; the box
 * starts checked when the journal holds something, and the dialog says so,
 * the journal naming the videos watched.
 *
 * @param {object} page From index.js (see lists-section.js).
 * @param {object} api The extension API, for the version and the browser.
 */
import { journalText } from '../../core/journal.js';
import { issueUrl, reportText, REPOSITORY_URL } from '../../core/report.js';
import { formatNumber, pluralKey } from '../shared/format.js';
import { setStatus, setUpDialog } from './dialog.js';

export function createReportSection(page, api) {
  const { byId, t, lang, store, act, confirmChange, state } = page;
  const version = api.runtime.getManifest().version;
  const dialog = setUpDialog(byId('report-dialog'));
  let journal = [];

  function render() {
    const debug = state.settings?.debug ?? false;
    byId('journal-row').hidden = !debug && journal.length === 0;
    byId('journal-count').textContent = t(pluralKey(journal.length, lang, 'journalCountOne', 'journalCountOther'), [formatNumber(journal.length, lang)]);
    byId('journal-copy').disabled = journal.length === 0;
    byId('journal-clear').disabled = journal.length === 0;
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
    byId('report-journal-label').textContent = t(pluralKey(journal.length, lang, 'reportJournalOne', 'reportJournalOther'), [formatNumber(journal.length, lang)]);
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
