/**
 * "Add channels": the user pastes links, @handles or video links, one per
 * line; the extension looks each channel up on YouTube (channel-lookup.js),
 * shows what would happen to it in the target list, and adds the channels
 * only on "Add". A channel already in the other list moves to the target
 * one: naming it here is an explicit choice. The change can be undone from
 * its notice.
 *
 * @param {object} page From index.js (see lists-section.js).
 * @param {{ lookUp?: Function }} [options] lookUp(lines, onProgress), the
 *   lookup of the lines; the real one asks YouTube.
 */
import { MAX_LINKS } from '../../core/channel-links.js';
import { ListFullError, normalizeChannels } from '../../core/channels.js';
import { readLinkLines } from '../../core/lists-file.js';
import { ImportMode, planImport } from '../../core/lists-import.js';
import { failureText } from '../shared/actions.js';
import { formatNumber, pluralKey } from '../shared/format.js';
import { lookUpLines } from './channel-lookup.js';
import { setStatus, setUpDialog } from './dialog.js';
import { entryRow } from './entry-row.js';
import { lookupLines, PART_LABELS } from './import-report.js';

export function createAddDialog(page, { lookUp = (lines, onProgress) => lookUpLines(lines, fetch, onProgress) } = {}) {
  const { doc, byId, t, store, confirmChange, state } = page;
  const dialog = setUpDialog(byId('add-dialog'));
  const status = byId('add-status');
  // The lookup of the text shown, kept while only the target list changes.
  let results = null;
  let searching = false;

  const target = () => doc.querySelector('input[name="add-target"]:checked').value;

  /** The channels found, once each, in the order of the lines. */
  const channelsFound = () => normalizeChannels((results ?? []).filter((result) => result.channel).map((result) => result.channel));

  /** How many channels "Add" would add to or move into the target list. */
  function changesFor(lists) {
    const list = target();
    const { report } = planImport({ lists, excludedVideos: [] }, { [list]: channelsFound() }, ImportMode.FOLLOW, new Date().toISOString());
    return report[list].added + report[list].moved;
  }

  function resultRow({ line, channel, text, ok }) {
    return entryRow(doc, {
      name: channel ? channel.name || t('channelUnknown') : line,
      avatar: channel ? { id: channel.id, name: channel.name, avatarUrl: channel.avatarUrl } : null,
      parts: channel ? [text, line] : [text],
      failed: !ok,
    });
  }

  function showResults() {
    byId('add-report').hidden = false;
    byId('add-results').replaceChildren(...lookupLines(results, state.settings.lists, target(), t).map(resultRow));
    let count = 0;
    try {
      count = changesFor(state.settings.lists);
      setStatus(status, count ? null : t('addNothing'));
    } catch (error) {
      if (!(error instanceof ListFullError)) throw error;
      setStatus(status, t('noticeListFull', [formatNumber(error.max, page.lang)]), { error: true });
    }
    const apply = byId('add-apply');
    apply.disabled = count === 0;
    apply.textContent = t(pluralKey(count, page.lang,'addApplyOne', 'addApplyOther'), [formatNumber(count, page.lang)]);
  }

  function reset() {
    results = null;
    byId('add-report').hidden = true;
    byId('add-results').replaceChildren();
    const apply = byId('add-apply');
    apply.disabled = true;
    apply.textContent = t('addApply');
  }

  async function search() {
    if (searching) return;
    const lines = readLinkLines(byId('add-lines').value);
    reset();
    byId('add-report').hidden = false;
    if (lines.length === 0) {
      setStatus(status, t('addEmpty'), { error: true });
      return;
    }
    if (lines.length > MAX_LINKS) {
      setStatus(status, t('addTooMany', [formatNumber(MAX_LINKS, page.lang)]), { error: true });
      return;
    }
    searching = true;
    byId('add-search').disabled = true;
    setStatus(status, t('addSearching', [formatNumber(0, page.lang), formatNumber(lines.length, page.lang)]));
    try {
      const found = await lookUp(lines, (done, total) => setStatus(status, t('addSearching', [formatNumber(done, page.lang), formatNumber(total, page.lang)])));
      // The text may have changed while YouTube answered.
      if (readLinkLines(byId('add-lines').value).join('\n') === lines.join('\n')) {
        results = found;
        showResults();
      }
    } finally {
      searching = false;
      byId('add-search').disabled = false;
    }
  }

  async function apply() {
    const list = target();
    const channels = channelsFound();
    let previous = null;
    let report = null;
    try {
      state.settings = await store.updateSettings((current) => {
        previous = current.lists;
        const plan = planImport(current, { [list]: channels }, ImportMode.FOLLOW, new Date().toISOString());
        report = plan.report[list];
        return { ...current, lists: plan.lists };
      });
    } catch (error) {
      setStatus(status, failureText(error, t, page.lang), { error: true });
      return;
    }
    dialog.close();
    page.refresh();
    const changed = report.added + report.moved;
    confirmChange(pluralKey(changed, page.lang,'noticeChannelsAddedOne', 'noticeChannelsAddedOther'), [formatNumber(changed, page.lang), t(PART_LABELS[list])], async () => {
      state.settings = await store.updateSettings((current) => ({ ...current, lists: previous }));
    });
  }

  function listen() {
    byId('add-lines').addEventListener('input', reset);
    for (const radio of doc.querySelectorAll('input[name="add-target"]')) {
      radio.addEventListener('change', () => {
        if (results) showResults();
      });
    }
    byId('add-search').addEventListener('click', () => page.act(search));
    byId('add-apply').addEventListener('click', () => page.act(apply));
  }

  /** Opens the dialog empty, with the target list given ('always' or 'never'). */
  function open(list = 'always') {
    byId('add-lines').value = '';
    const radio = doc.querySelector(`input[name="add-target"][value="${list === 'never' ? 'never' : 'always'}"]`);
    radio.checked = true;
    reset();
    setStatus(status, null);
    dialog.open();
    byId('add-lines').focus();
  }

  return { open, listen };
}
