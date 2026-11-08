/**
 * The menu of the options page marks the section being read (see
 * sections.js). A section chosen in the menu stays marked until the user
 * scrolls again, even when the page cannot scroll far enough to bring it to
 * the reading line.
 */
import { currentSection } from './sections.js';

// Height under which a section counts as read at the top of the page: the
// sticky header, and a little margin.
const SECTION_OFFSET_PX = 120;
// User input that may scroll the page, and so ends a choice made in the menu.
const SCROLL_INPUTS = ['wheel', 'touchstart', 'keydown'];

/** @param {Element} nav The menu, of links to #id. @param {Element[]} sections In page order. */
export function highlightSections(win, nav, sections) {
  const links = [...nav.querySelectorAll('a')];
  let chosen = null;
  const mark = (id) => {
    for (const link of links) link.setAttribute('aria-current', String(link.hash === `#${id}`));
  };
  // Browsers fire scroll at most once per frame, and the update reads the
  // position of a few sections: it runs on each scroll event as it comes.
  const update = () => {
    if (chosen) return;
    const root = win.document.documentElement;
    const index = currentSection(
      sections.map((section) => section.getBoundingClientRect().top),
      { scrollY: win.scrollY, scrollMax: root.scrollHeight - win.innerHeight, height: win.innerHeight, offset: SECTION_OFFSET_PX },
    );
    mark(sections[index].id);
  };
  nav.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    chosen = link.hash.slice(1);
    mark(chosen);
  });
  for (const type of SCROLL_INPUTS) {
    win.addEventListener(type, () => (chosen = null), { passive: true, capture: true });
  }
  win.addEventListener('scroll', update, { passive: true });
  update();
}
