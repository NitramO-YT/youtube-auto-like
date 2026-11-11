/**
 * "Export": the parts chosen, as a file of the extension (JSON, imported
 * back as it is, dates and avatars included) or as a list of links to read
 * or share (channel lists only: an excluded video names no channel). The
 * file can also hold all the other settings and the history of likes, to
 * find them again in another browser or after a new installation.
 *
 * @param {object} page From index.js (see lists-section.js).
 */
import { linksFileName, listsFileName, serializeLinks, serializeLists } from '../../core/lists-file.js';
import { ImportPart, IMPORT_PARTS } from '../../core/lists-import.js';
import { formatNumber } from '../shared/format.js';
import { setUpDialog } from './dialog.js';
import { PART_LABELS } from './import-report.js';

/** Has the browser save a text as a file of that name. */
function download(doc, text, type, name) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// The parts a list of links cannot hold.
const FILE_ONLY_PARTS = [ImportPart.VIDEOS, ImportPart.SETTINGS, ImportPart.HISTORY];

export function createExportDialog(page) {
  const { doc, byId, t, store, state } = page;
  const dialog = setUpDialog(byId('export-dialog'));
  const boxOf = (part) => doc.querySelector(`input[name="export-part"][value="${part}"]`);

  const checked = (name) => [...doc.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
  const format = () => checked('export-format')[0];
  // The parts the user wants in a file, kept while a list of links, which
  // cannot hold them, shows their boxes unchecked.
  const wanted = Object.fromEntries(FILE_ONLY_PARTS.map((part) => [part, true]));
  // The history, read when the dialog opens.
  let history = [];

  /** A list of links holds channels only. */
  function showFormat() {
    const links = format() === 'links';
    for (const part of FILE_ONLY_PARTS) {
      const box = boxOf(part);
      if (links && !box.disabled) wanted[part] = box.checked;
      box.disabled = links;
      box.checked = links ? false : wanted[part];
    }
  }

  function exportChosen() {
    const parts = checked('export-part');
    const error = byId('export-error');
    error.hidden = parts.length > 0;
    error.textContent = parts.length ? '' : t('exportNothing');
    if (!parts.length) return;
    const { settings } = state;
    const { lists, excludedVideos } = settings;
    const now = new Date();
    if (format() === 'links') {
      const sections = parts.map((part) => ({ title: t(PART_LABELS[part]), channels: lists[part] }));
      download(doc, serializeLinks(sections), 'text/plain', linksFileName(now));
    } else {
      const chosen = { always: parts.includes('always') ? lists.always : [], never: parts.includes('never') ? lists.never : [] };
      const withSettings = parts.includes(ImportPart.SETTINGS);
      const extra = { settings: withSettings ? settings : null, history: parts.includes(ImportPart.HISTORY) ? history : null };
      const text = serializeLists(chosen, parts.includes('videos') ? excludedVideos : [], now.toISOString(), extra);
      download(doc, text, 'application/json', listsFileName(now, withSettings));
    }
    dialog.close();
  }

  function listen() {
    for (const radio of doc.querySelectorAll('input[name="export-format"]')) radio.addEventListener('change', showFormat);
    byId('export-download').addEventListener('click', exportChosen);
  }

  /** Opens the dialog with the size of each list and of the history. */
  async function open() {
    history = await store.loadHistory();
    const { lists, excludedVideos } = state.settings;
    const counts = { always: lists.always.length, never: lists.never.length, videos: excludedVideos.length, history: history.length };
    for (const part of [...IMPORT_PARTS, ImportPart.HISTORY]) {
      byId(`export-part-${part}`).textContent = t('partWithCount', [t(PART_LABELS[part]), formatNumber(counts[part], page.lang)]);
    }
    byId(`export-part-${ImportPart.SETTINGS}`).textContent = t(PART_LABELS[ImportPart.SETTINGS]);
    byId('export-error').hidden = true;
    showFormat();
    dialog.open();
    byId('export-download').focus();
  }

  return { open, listen };
}
