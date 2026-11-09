import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pagerLabels } from '../../src/ui/options/pager.js';
import { translator } from '../helpers/fake-i18n.mjs';

const fr = translator('fr');

describe('pagerLabels', () => {
  it('says how many rows are shown, how many more the button adds, and how many in all', () => {
    assert.deepEqual(pagerLabels(20, 500, 20, fr, 'fr'), {
      hidden: false,
      count: '20 sur 500',
      more: 'Afficher 20 de plus',
      all: 'Tout afficher (500)',
    });
    assert.equal(pagerLabels(40, 45, 20, fr, 'fr').more, 'Afficher 5 de plus');
    assert.equal(pagerLabels(50, 500, 50, fr, 'fr').more, 'Afficher 50 de plus');
  });

  it('hides itself once every row is shown', () => {
    assert.deepEqual(pagerLabels(45, 45, 20, fr, 'fr'), { hidden: true });
    assert.deepEqual(pagerLabels(3, 3, 20, fr, 'fr'), { hidden: true });
  });
});
