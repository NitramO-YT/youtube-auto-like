import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { currentSection, scrollTargetFor } from '../../src/ui/options/sections.js';

// Five sections at these page positions; a window of 1000 px whose page
// scrolls by 200 px only, as on a large screen.
const PAGE_TOPS = [100, 420, 560, 800, 1050];
const view = (scrollY, scrollMax = 200, height = 1000) => ({ scrollY, scrollMax, height, offset: 120 });
const at = (scrollY, scrollMax, height) =>
  currentSection(
    PAGE_TOPS.map((top) => top - scrollY),
    view(scrollY, scrollMax, height),
  );

describe('currentSection', () => {
  it('starts on the first section, and ends on the last at the bottom of the page', () => {
    assert.equal(at(0), 0);
    assert.equal(at(200), 4);
  });

  it('goes through every section on a page that barely scrolls', () => {
    const seen = new Set();
    for (let scrollY = 0; scrollY <= 200; scrollY += 5) seen.add(at(scrollY));
    assert.deepEqual([...seen], [0, 1, 2, 3, 4]);
  });

  it('never goes back up while the page scrolls down', () => {
    let previous = 0;
    for (let scrollY = 0; scrollY <= 200; scrollY += 1) {
      const current = at(scrollY);
      assert.ok(current >= previous, `at ${scrollY}`);
      previous = current;
    }
  });

  it('reads a page that does not scroll from its first section', () => {
    assert.equal(at(0, 0, 2000), 0);
  });

  it('brings a section chosen in the menu onto the reading line, whatever the screen', () => {
    for (const [scrollMax, height] of [[200, 1000], [1000, 300], [880, 613]]) {
      PAGE_TOPS.forEach((pageTop, index) => {
        const target = scrollTargetFor(pageTop, { scrollMax, height, offset: 120 });
        assert.ok(target >= 0 && target <= scrollMax);
        assert.equal(at(target, scrollMax, height), index, `section ${index}, ${height} px high, scrolling ${scrollMax} px`);
      });
    }
  });

  it('goes on from the chosen section when the page scrolls a little further, never back', () => {
    for (const [scrollMax, height] of [[200, 1000], [1000, 300]]) {
      PAGE_TOPS.forEach((pageTop, index) => {
        const target = scrollTargetFor(pageTop, { scrollMax, height, offset: 120 });
        assert.ok(at(Math.min(scrollMax, target + 3), scrollMax, height) >= index);
        assert.ok(at(Math.max(0, target - 3), scrollMax, height) <= index);
      });
    }
  });

  it('follows the header on a long page', () => {
    // A small window: the page scrolls by 1000 px, each section reaches the top.
    assert.equal(at(330, 1000, 300), 1);
    assert.equal(at(700, 1000, 300), 3);
  });
});
