import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { createTranslator, emphasized } from '../../src/ui/shared/i18n.js';

describe('createTranslator', () => {
  it('passes the substitutions as strings', () => {
    const t = createTranslator((key, substitutions) => `${key}:${substitutions.join('|')}`);
    assert.equal(t('count', [3, 'x']), 'count:3|x');
  });

  it('shows the key of a missing text, and reports it', () => {
    const error = mock.method(console, 'error', () => {});
    try {
      assert.equal(createTranslator(() => '')('missingKey'), 'missingKey');
      assert.equal(error.mock.callCount(), 1);
    } finally {
      error.mock.restore();
    }
  });
});

describe('emphasized', () => {
  it('cuts a sentence around its substitutions, whatever their order', () => {
    // A language that puts the second substitution first.
    const t = createTranslator((key, [first, second]) => `${second} then ${first}.`);
    assert.deepEqual(emphasized(t, 'any', ['A', 'B']), [
      { text: 'B', strong: true },
      { text: ' then ', strong: false },
      { text: 'A', strong: true },
      { text: '.', strong: false },
    ]);
  });
});
