/**
 * Long lists of the options page (channels, excluded videos, history) show
 * their first entries, then more at each "Show more": the page keeps its
 * length, and the sections after a long list stay close.
 */
import { formatNumber } from '../shared/format.js';

export const PAGE_SIZE = 20;

/**
 * Under a list showing `shown` of its `total` entries: "20 of 500" and
 * "Show 20 more", or nothing once every entry is shown.
 *
 * @param {{ row: Element, count: Element, button: Element }} elements
 */
export function renderMore({ row, count, button }, shown, total, t, lang) {
  row.hidden = shown >= total;
  if (row.hidden) return;
  count.textContent = t('listShownOf', [formatNumber(shown, lang), formatNumber(total, lang)]);
  button.textContent = t('listShowMore', [formatNumber(Math.min(PAGE_SIZE, total - shown), lang)]);
}
