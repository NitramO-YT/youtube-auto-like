/**
 * "Export": the lists chosen, as a file of the extension (JSON, imported
 * back as it is, dates and avatars included) or as a list of links to read
 * or share (channel lists only: an excluded video names no channel).
 *
 * @param {object} page From index.js (see lists-section.js).
 */
import { linksFileName, listsFileName, serializeLinks, serializeLists } from '../../core/lists-file.js';
import { IMPORT_PARTS } from '../../core/lists-import.js';
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

export function createExportDialog(page) {
  const { doc, byId, t, state } = page;
  const dialog = setUpDialog(byId('export-dialog'));
  const videosBox = doc.querySelector('input[name="export-part"][value="videos"]');

  const checked = (name) => [...doc.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
  const format = () => checked('export-format')[0];
  // Whether the user wants the excluded videos, kept while a list of links,
  // which cannot hold them, shows the box unchecked.
  let videosWanted = true;

  /** A list of links holds channels only. */
  function showFormat() {
    const links = format() === 'links';
    if (links && !videosBox.disabled) videosWanted = videosBox.checked;
    videosBox.disabled = links;
    videosBox.checked = links ? false : videosWanted;
  }

  function exportChosen() {
    const parts = checked('export-part');
    const error = byId('export-error');
    error.hidden = parts.length > 0;
    error.textContent = parts.length ? '' : t('exportNothing');
    if (!parts.length) return;
    const { lists, excludedVideos } = state.settings;
    const now = new Date();
    if (format() === 'links') {
      const sections = parts.map((part) => ({ title: t(PART_LABELS[part]), channels: lists[part] }));
      download(doc, serializeLinks(sections), 'text/plain', linksFileName(now));
    } else {
      const chosen = { always: parts.includes('always') ? lists.always : [], never: parts.includes('never') ? lists.never : [] };
      download(doc, serializeLists(chosen, parts.includes('videos') ? excludedVideos : [], now.toISOString()), 'application/json', listsFileName(now));
    }
    dialog.close();
  }

  function listen() {
    for (const radio of doc.querySelectorAll('input[name="export-format"]')) radio.addEventListener('change', showFormat);
    byId('export-download').addEventListener('click', exportChosen);
  }

  /** Opens the dialog with the size of each list. */
  function open() {
    const { lists, excludedVideos } = state.settings;
    const counts = { always: lists.always.length, never: lists.never.length, videos: excludedVideos.length };
    for (const part of IMPORT_PARTS) {
      byId(`export-part-${part}`).textContent = t('partWithCount', [t(PART_LABELS[part]), formatNumber(counts[part], page.lang)]);
    }
    byId('export-error').hidden = true;
    showFormat();
    dialog.open();
    byId('export-download').focus();
  }

  return { open, listen };
}
