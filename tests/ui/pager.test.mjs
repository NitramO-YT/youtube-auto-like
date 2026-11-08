import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PAGE_SIZE, renderMore } from '../../src/ui/options/pager.js';
import { translator } from '../helpers/fake-i18n.mjs';

const fr = translator('fr');
const elements = () => ({ row: { hidden: true }, count: { textContent: '' }, button: { textContent: '' } });

describe('renderMore', () => {
  it('says how many entries are shown, and how many more the button adds', () => {
    const shown = elements();
    renderMore(shown, PAGE_SIZE, 500, fr, 'fr');
    assert.equal(shown.row.hidden, false);
    assert.equal(shown.count.textContent, '20 sur 500');
    assert.equal(shown.button.textContent, 'Afficher 20 de plus');
    const last = elements();
    renderMore(last, 40, 45, fr, 'fr');
    assert.equal(last.button.textContent, 'Afficher 5 de plus');
  });

  it('hides itself once every entry is shown', () => {
    const all = elements();
    renderMore(all, 45, 45, fr, 'fr');
    assert.equal(all.row.hidden, true);
    renderMore(all, 20, 3, fr, 'fr');
    assert.equal(all.row.hidden, true);
  });
});
