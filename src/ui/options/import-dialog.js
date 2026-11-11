/**
 * "Import", after the import of the Openiera CRM: a source (a file chosen
 * or dropped, or text pasted with Ctrl+V), the parts to import, what to do
 * with the entries already there (core/lists-import.js), then "Analyse",
 * which shows what would change, and "Import", which applies the same
 * plan. Taking entries out ("Replace everything") also requires ticking a
 * confirmation, never remembered.
 *
 * Two sources are understood: a file exported by the extension (JSON, see
 * core/lists-file.js), and a list of links or @handles, one per line,
 * looked up on YouTube at the analysis and put in the list chosen. A file
 * that also holds the settings or the history offers them as two more
 * parts, which planImport handles whatever the mode.
 *
 * Once analysed, a change of parts, mode or list updates the report at
 * once, without asking YouTube again; another source starts over.
 *
 * @param {object} page From index.js (see lists-section.js).
 * @param {{ lookUp?: Function }} [options] As for add-dialog.js.
 */
import { MAX_LINKS } from '../../core/channel-links.js';
import { ListFullError, normalizeChannels } from '../../core/channels.js';
import { ImportError, MAX_LISTS_FILE_BYTES, parseListsFile, readLinkLines } from '../../core/lists-file.js';
import { BACKUP_PARTS, IMPORT_MODES, IMPORT_PARTS, importChanges, ImportMode, ImportPart, planImport } from '../../core/lists-import.js';
import { failureText } from '../shared/actions.js';
import { el } from '../shared/dom.js';
import { formatNumber, pluralKey } from '../shared/format.js';
import { lookUpLines } from './channel-lookup.js';
import { setStatus, setUpDialog } from './dialog.js';
import { entryRow } from './entry-row.js';
import { detailLines, lookupLines, PART_LABELS, removedCount, reportLines, totalsLine } from './import-report.js';

// « Mémoriser mon choix »: the mode is kept in this browser only.
const MODE_STORAGE_KEY = 'youtube-auto-like:import-mode';

function rememberedMode(storage) {
  try {
    const value = storage.getItem(MODE_STORAGE_KEY);
    return IMPORT_MODES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function rememberMode(storage, mode) {
  try {
    if (mode) storage.setItem(MODE_STORAGE_KEY, mode);
    else storage.removeItem(MODE_STORAGE_KEY);
  } catch {
    // Storage unavailable: the choice simply is not kept for the next import.
  }
}

export function createImportDialog(page, { lookUp = (lines, onProgress) => lookUpLines(lines, fetch, onProgress), storage = window.localStorage } = {}) {
  const { doc, byId, t, store, confirmChange, state } = page;
  const element = byId('import-dialog');
  const dialog = setUpDialog(element);
  const status = byId('import-status');
  // { kind: 'file', name, size, data: { lists, excludedVideos, settings, history } } or
  // { kind: 'links', name, size, lines, results }, results once looked up.
  let source = null;
  let analysed = false;
  let busy = false;
  // The history, read when the dialog opens, for the analysis; the import
  // reads it again.
  let history = [];

  const checked = (name) => [...doc.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
  const mode = () => checked('import-mode')[0] ?? ImportMode.ADD_NEW;

  /** The parts to import, as planImport takes them. */
  function incoming() {
    if (source.kind === 'links') {
      const channels = normalizeChannels(source.results.filter((result) => result.channel).map((result) => result.channel));
      return { [checked('import-target')[0]]: channels };
    }
    const parts = checked('import-part');
    const { lists, excludedVideos, settings, history: likes } = source.data;
    const chosen = {};
    if (parts.includes('always')) chosen.always = lists.always;
    if (parts.includes('never')) chosen.never = lists.never;
    if (parts.includes('videos')) chosen.videos = excludedVideos;
    if (parts.includes(ImportPart.SETTINGS) && settings) chosen.settings = settings;
    if (parts.includes(ImportPart.HISTORY) && likes) chosen.history = likes;
    return chosen;
  }

  function plan() {
    return planImport(state.settings, incoming(), mode(), new Date().toISOString(), history);
  }

  function resetReport() {
    analysed = false;
    byId('import-report').hidden = true;
    byId('import-lines').replaceChildren();
    byId('import-entries').replaceChildren();
    byId('import-failures').replaceChildren();
    byId('import-confirm-row').hidden = true;
    byId('import-confirm').checked = false;
    byId('import-apply').disabled = true;
  }

  function showSource() {
    byId('import-source-empty').hidden = Boolean(source);
    byId('import-source-filled').hidden = !source;
    byId('import-parts').hidden = source?.kind !== 'file';
    byId('import-links-target').hidden = source?.kind !== 'links';
    if (!source) return;
    byId('import-source-name').textContent = source.name;
    byId('import-source-detail').textContent =
      source.kind === 'file'
        ? t('importSourceFile')
        : t(pluralKey(source.lines.length, page.lang,'importSourceLinksOne', 'importSourceLinksOther'), [formatNumber(source.lines.length, page.lang)]);
    if (source.kind === 'file') {
      const counts = { always: source.data.lists.always.length, never: source.data.lists.never.length, videos: source.data.excludedVideos.length };
      for (const part of IMPORT_PARTS) {
        byId(`import-part-${part}`).textContent = t('partWithCount', [t(PART_LABELS[part]), formatNumber(counts[part], page.lang)]);
        doc.querySelector(`input[name="import-part"][value="${part}"]`).checked = counts[part] > 0;
      }
      // The settings and the history, offered only when the file holds them.
      for (const part of BACKUP_PARTS) {
        const held = source.data[part] !== null;
        byId(`import-part-row-${part}`).hidden = !held;
        doc.querySelector(`input[name="import-part"][value="${part}"]`).checked = held;
      }
      byId('import-part-settings').textContent = t(PART_LABELS[ImportPart.SETTINGS]);
      if (source.data.history) {
        byId('import-part-history').textContent = t('partWithCount', [t(PART_LABELS[ImportPart.HISTORY]), formatNumber(source.data.history.length, page.lang)]);
      }
      byId('import-backup-hint').hidden = BACKUP_PARTS.every((part) => source.data[part] === null);
    }
  }

  function sourceError(key, substitutions = []) {
    const error = byId('import-source-error');
    error.hidden = !key;
    error.textContent = key ? t(key, substitutions) : '';
  }

  /** Takes a text as the source, or says why it cannot be one. */
  function accept(text, name, size) {
    resetReport();
    setStatus(status, null);
    if (size > MAX_LISTS_FILE_BYTES) {
      sourceError('noticeImportTooBig');
      return;
    }
    if (text.trimStart().startsWith('{')) {
      const data = parseListsFile(text, size);
      if (data.error) {
        sourceError(data.error === ImportError.TOO_BIG ? 'noticeImportTooBig' : 'noticeImportInvalid');
        return;
      }
      source = { kind: 'file', name, size, data };
    } else {
      const lines = readLinkLines(text);
      if (lines.length === 0) {
        sourceError('importNotUnderstood');
        return;
      }
      if (lines.length > MAX_LINKS) {
        sourceError('addTooMany', [formatNumber(MAX_LINKS, page.lang)]);
        return;
      }
      source = { kind: 'links', name, size, lines, results: null };
    }
    sourceError(null);
    showSource();
  }

  async function acceptFile(file) {
    if (!file) return;
    // A file too large is refused before being read.
    accept(file.size > MAX_LISTS_FILE_BYTES ? '' : await file.text(), file.name, file.size);
  }

  /** A transfer (drop or paste): its file, or else its text. */
  async function acceptTransfer(transfer) {
    const [file] = transfer?.files ?? [];
    if (file) {
      await acceptFile(file);
      return;
    }
    const text = transfer?.getData('text/plain') ?? '';
    if (text.trim()) accept(text, t('importPasted'), new Blob([text]).size);
  }

  function showReport() {
    byId('import-report').hidden = false;
    let result;
    try {
      result = plan();
    } catch (error) {
      if (!(error instanceof ListFullError)) throw error;
      setStatus(status, t('importListFull', [formatNumber(error.max, page.lang)]), { error: true });
      byId('import-lines').replaceChildren();
      byId('import-entries').replaceChildren();
      byId('import-apply').disabled = true;
      return;
    }
    const { report, details } = result;
    const changes = importChanges(report);
    setStatus(status, Object.keys(report).length === 0 ? t('importNoPart') : changes ? null : t('reportNothing'));
    byId('import-lines').replaceChildren(...reportLines(report, t, page.lang).map((line) => el(doc, 'li', null, line)));
    byId('import-entries').replaceChildren(...detailLines(details, t).map((line) => entryRow(doc, line)));
    // The lines of a list of links that add nothing: not found, or naming a channel again.
    const skipped = source.kind === 'links' ? lookupLines(source.results, state.settings.lists, checked('import-target')[0], t).filter((line) => !line.ok || line.duplicate) : [];
    byId('import-failures').replaceChildren(
      ...skipped.map(({ line, text, ok, channel }) =>
        entryRow(doc, {
          name: line,
          avatar: channel ? { id: channel.id, name: channel.name, avatarUrl: channel.avatarUrl } : null,
          parts: [text],
          failed: !ok,
        }),
      ),
    );
    const removed = removedCount(report);
    byId('import-confirm-row').hidden = removed === 0;
    if (removed === 0) byId('import-confirm').checked = false;
    byId('import-confirm-text').textContent = t(pluralKey(removed, page.lang,'importConfirmOne', 'importConfirmOther'), [formatNumber(removed, page.lang)]);
    byId('import-apply').disabled = !changes || (removed > 0 && !byId('import-confirm').checked);
  }

  async function analyse() {
    if (busy) return;
    if (!source) {
      sourceError('importNoSource');
      return;
    }
    if (source.kind === 'links' && !source.results) {
      busy = true;
      byId('import-analyse').disabled = true;
      byId('import-report').hidden = false;
      const asked = source;
      setStatus(status, t('addSearching', [formatNumber(0, page.lang), formatNumber(asked.lines.length, page.lang)]));
      try {
        const results = await lookUp(asked.lines, (done, total) => setStatus(status, t('addSearching', [formatNumber(done, page.lang), formatNumber(total, page.lang)])));
        // Another source may have been chosen while YouTube answered.
        if (source !== asked) return;
        source.results = results;
      } finally {
        busy = false;
        byId('import-analyse').disabled = false;
      }
    }
    analysed = true;
    showReport();
  }

  async function apply() {
    if (!analysed || busy) return;
    const chosen = incoming();
    const chosenMode = mode();
    let previous = null;
    let previousHistory = null;
    let result = null;
    try {
      const currentHistory = chosen.history ? await store.loadHistory() : [];
      state.settings = await store.updateSettings((current) => {
        // Imported settings replace them all; otherwise, only the lists change.
        previous = chosen.settings ? current : { lists: current.lists, excludedVideos: current.excludedVideos };
        result = planImport(current, chosen, chosenMode, new Date().toISOString(), currentHistory);
        return result.settings ?? { ...current, lists: result.lists, excludedVideos: result.excludedVideos };
      });
      if (result.history && result.history !== currentHistory) {
        previousHistory = currentHistory;
        await store.setHistory(result.history);
      }
    } catch (error) {
      setStatus(status, failureText(error, t, page.lang), { error: true });
      return;
    }
    rememberMode(storage, byId('import-remember').checked ? chosenMode : null);
    dialog.close();
    page.refresh();
    confirmChange('noticeImportDone', [totalsLine(result.report, t, page.lang)], async () => {
      state.settings = await store.updateSettings((current) => ({ ...current, ...previous }));
      if (previousHistory) await store.setHistory(previousHistory);
    });
  }

  function listen() {
    const input = byId('import-file');
    byId('import-browse').addEventListener('click', () => input.click());
    byId('import-source-change').addEventListener('click', () => input.click());
    byId('import-source-remove').addEventListener('click', () => {
      source = null;
      resetReport();
      setStatus(status, null);
      sourceError(null);
      showSource();
    });
    input.addEventListener('change', () => {
      const [file] = input.files;
      // Reset so that choosing the same file again still fires a change.
      input.value = '';
      page.act(() => acceptFile(file));
    });

    const zone = byId('import-source');
    const carries = (transfer) => [...(transfer?.types ?? [])].some((type) => type === 'Files' || type === 'text/plain');
    zone.addEventListener('dragover', (event) => {
      if (!carries(event.dataTransfer)) return;
      event.preventDefault();
      zone.classList.add('dragging');
    });
    zone.addEventListener('dragleave', (event) => {
      // dragleave also fires when moving onto a child: only a leave towards
      // the outside of the zone ends the highlight.
      if (!zone.contains(event.relatedTarget)) zone.classList.remove('dragging');
    });
    zone.addEventListener('drop', (event) => {
      if (!carries(event.dataTransfer)) return;
      event.preventDefault();
      zone.classList.remove('dragging');
      const transfer = event.dataTransfer;
      page.act(() => acceptTransfer(transfer));
    });
    // Ctrl+V anywhere in the dialog: it holds no text field.
    element.addEventListener('paste', (event) => {
      event.preventDefault();
      const transfer = event.clipboardData;
      page.act(() => acceptTransfer(transfer));
    });

    for (const name of ['import-part', 'import-mode', 'import-target']) {
      for (const radio of doc.querySelectorAll(`input[name="${name}"]`)) {
        radio.addEventListener('change', () => {
          byId('import-confirm').checked = false;
          if (analysed) showReport();
        });
      }
    }
    byId('import-confirm').addEventListener('change', () => {
      if (analysed) showReport();
    });
    byId('import-analyse').addEventListener('click', () => page.act(analyse));
    byId('import-apply').addEventListener('click', () => page.act(apply));
  }

  /** Opens the dialog without a source, with the remembered mode. */
  async function open() {
    history = await store.loadHistory();
    source = null;
    resetReport();
    setStatus(status, null);
    sourceError(null);
    showSource();
    const remembered = rememberedMode(storage);
    doc.querySelector(`input[name="import-mode"][value="${remembered ?? ImportMode.ADD_NEW}"]`).checked = true;
    byId('import-remember').checked = remembered !== null;
    dialog.open();
    byId('import-browse').focus();
  }

  return { open, listen };
}
