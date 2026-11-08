/**
 * The menu of the options page: marks the section being read (see
 * sections.js), and scrolls to a section chosen in it. Both follow the same
 * reading line: a chosen section lands on the line, so it is the one marked,
 * and scrolling from there goes on from it.
 */
import { currentSection, scrollTargetFor } from './sections.js';

// Height under which a section counts as read at the top of the page: the
// sticky header, and a little margin.
const SECTION_OFFSET_PX = 120;

/** @param {Element} nav The menu, of links to #id. @param {Element[]} sections In page order. */
export function highlightSections(win, nav, sections) {
  const links = [...nav.querySelectorAll('a')];
  const root = win.document.documentElement;
  const view = () => ({ scrollMax: root.scrollHeight - win.innerHeight, height: win.innerHeight, offset: SECTION_OFFSET_PX });
  const reduceMotion = win.matchMedia('(prefers-reduced-motion: reduce)');

  // Browsers fire scroll at most once per frame, and the update reads the
  // position of a few sections: it runs on each scroll event as it comes.
  const update = () => {
    const index = currentSection(
      sections.map((section) => section.getBoundingClientRect().top),
      { ...view(), scrollY: win.scrollY },
    );
    for (const link of links) link.setAttribute('aria-current', String(link.hash === `#${sections[index].id}`));
  };

  for (const section of sections) section.setAttribute('tabindex', '-1');
  nav.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    const section = link && sections.find((candidate) => `#${candidate.id}` === link.hash);
    if (!section) return;
    event.preventDefault();
    const pageTop = section.getBoundingClientRect().top + win.scrollY;
    win.scrollTo({ top: scrollTargetFor(pageTop, view()), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    // Keyboard users go on from the section chosen.
    section.focus({ preventScroll: true });
    win.history.replaceState(null, '', link.hash);
  });
  win.addEventListener('scroll', update, { passive: true });
  update();
}
