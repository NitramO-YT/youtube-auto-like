/**
 * Which section of the options page is being read, for its menu.
 *
 * A reading line goes down the window as the page scrolls: just under the
 * header at the top of the page, at the bottom of the window once the page
 * is scrolled to its end, in proportion in between. The current section is
 * the last one whose top has passed that line. Every section becomes the
 * current one at some point, even on a screen where the page barely scrolls
 * and the middle sections never reach the top of the window.
 */

/**
 * @param {number[]} tops Top of each section, in window coordinates, in
 *   page order.
 * @param {object} view { scrollY, scrollMax (0 when the page does not
 *   scroll), height (of the window), offset (height under which a section
 *   counts as read at the top of the page: the header, and a margin) }
 * @returns {number} Index of the current section.
 */
export function currentSection(tops, { scrollY, scrollMax, height, offset }) {
  const progress = scrollMax > 0 ? Math.min(1, Math.max(0, scrollY / scrollMax)) : 0;
  const line = offset + progress * (height - 1 - offset);
  let current = 0;
  tops.forEach((top, index) => {
    if (top <= line) current = index;
  });
  return current;
}

/**
 * The scroll position that brings a section chosen in the menu onto the
 * reading line, so that it is the current one, and that scrolling from there
 * goes on from it.
 *
 * With line(y) = offset + y / scrollMax × (height − 1 − offset), the top of
 * the section, pageTop − y in window coordinates, meets the line at
 * y = (pageTop − offset) / (1 + (height − 1 − offset) / scrollMax). Rounded
 * up, so that the top is on the line or just above it.
 *
 * @param {number} pageTop Top of the section in page coordinates.
 * @param {object} view { scrollMax, height, offset }, as for currentSection.
 */
export function scrollTargetFor(pageTop, { scrollMax, height, offset }) {
  if (scrollMax <= 0) return 0;
  const target = Math.ceil((pageTop - offset) / (1 + (height - 1 - offset) / scrollMax));
  return Math.min(scrollMax, Math.max(0, target));
}
