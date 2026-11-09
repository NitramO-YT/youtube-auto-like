/**
 * Long lists of the options page (channels, excluded videos, history): they
 * show a first page of rows (the listPageSize setting, 0 for all), then more
 * at each "Show more", or all with "Show all". Past the first page, the rows
 * scroll inside a box as high as the first page, so the page never grows
 * and the sections after a long list stay close.
 */
import { formatNumber } from '../shared/format.js';

/**
 * What shows under a list of `shown` rows out of `total`, with pages of
 * `pageSize` rows: { hidden } once every row is shown, otherwise the count
 * ("20 of 500"), "Show 20 more" and "Show all (500)".
 */
export function pagerLabels(shown, total, pageSize, t, lang) {
  if (shown >= total) return { hidden: true };
  return {
    hidden: false,
    count: t('listShownOf', [formatNumber(shown, lang), formatNumber(total, lang)]),
    more: t('listShowMore', [formatNumber(Math.min(pageSize, total - shown), lang)]),
    all: t('listShowAll', [formatNumber(total, lang)]),
  };
}

/** Height of the first `count` rows of a list, borders of the list included. */
function firstRowsHeight(rows, count) {
  const items = rows.children;
  const top = items[0].getBoundingClientRect().top;
  const bottom = items[count - 1].getBoundingClientRect().bottom;
  const style = rows.ownerDocument.defaultView.getComputedStyle(rows);
  return Math.ceil(bottom - top + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth));
}

/**
 * @param {{ rows: Element, row: Element, count: Element, more: Element, all: Element }} elements
 *   rows: the list; row: the line under it, with count and the two buttons.
 * @param {{ t: Function, lang: string, redraw: Function }} options redraw
 *   draws the list again, calling slice and render.
 */
export function createPager(elements, { t, lang, redraw }) {
  let pageSize = 20;
  let limit = pageSize;

  elements.more.addEventListener('click', () => {
    const first = limit;
    limit += pageSize;
    redraw();
    // Brings the first new row into the box.
    const added = elements.rows.children[first];
    if (added) elements.rows.scrollTop = added.offsetTop - elements.rows.firstElementChild.offsetTop;
  });
  elements.all.addEventListener('click', () => {
    limit = Number.POSITIVE_INFINITY;
    redraw();
  });

  return {
    /** Applies the listPageSize setting; a new size starts from the first page again. */
    setPageSize(size) {
      if (size === pageSize) return;
      pageSize = size;
      limit = size || Number.POSITIVE_INFINITY;
    },
    /** Back to the first page: another tab, another search. */
    reset() {
      limit = pageSize || Number.POSITIVE_INFINITY;
      elements.rows.scrollTop = 0;
    },
    /** The rows to draw. */
    slice(entries) {
      return entries.slice(0, limit);
    },
    /** The line under the list, and the box once past the first page; after the rows are drawn. */
    render(shown, total) {
      const labels = pagerLabels(shown, total, pageSize || total, t, lang);
      elements.row.hidden = labels.hidden;
      if (!labels.hidden) {
        elements.count.textContent = labels.count;
        elements.more.textContent = labels.more;
        elements.all.textContent = labels.all;
      }
      const boxed = pageSize > 0 && shown > pageSize;
      elements.rows.classList.toggle('boxed', boxed);
      elements.rows.style.maxHeight = boxed ? `${firstRowsHeight(elements.rows, pageSize)}px` : '';
    },
  };
}
