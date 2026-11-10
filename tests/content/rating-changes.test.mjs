import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ratingChanges } from '../../src/content/isolated/rating-changes.js';

const shown = (liked, disliked) => ({ liked, disliked });
const texts = (changes) => changes.map((change) => change.text);

describe('ratingChanges', () => {
  it('tells a like or a dislike given or removed on the page', () => {
    assert.deepEqual(ratingChanges(shown(true, false), shown(false, false)), [{ button: 'like', given: false, text: 'like removed on the page' }]);
    assert.deepEqual(ratingChanges(shown(false, false), shown(true, false)), [{ button: 'like', given: true, text: 'like given on the page' }]);
    assert.deepEqual(texts(ratingChanges(shown(false, false), shown(false, true))), ['dislike given on the page']);
    assert.deepEqual(texts(ratingChanges(shown(true, false), shown(false, true))), ['like removed on the page', 'dislike given on the page']);
  });

  it('says nothing without a change, before a first observation, or for a button missing for a moment', () => {
    assert.deepEqual(ratingChanges(shown(true, false), shown(true, false)), []);
    assert.deepEqual(ratingChanges(null, shown(true, false)), []);
    assert.deepEqual(ratingChanges(shown(true, false), shown(null, false)), []);
    assert.deepEqual(ratingChanges(shown(null, false), shown(true, false)), []);
  });
});
