import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { createTranslator, emphasized, translatePage } from '../../src/ui/shared/i18n.js';

describe('translatePage', () => {
  // Elements with what translatePage uses: attributes and textContent.
  const element = (attributes) => ({ attributes: { ...attributes }, textContent: '', getAttribute(name) { return this.attributes[name] ?? null; }, setAttribute(name, value) { this.attributes[name] = value; } });
  const root = (elements) => ({
    querySelectorAll: (selector) => elements.filter((item) => selector.slice(1, -1) in item.attributes),
  });

  it('fills the text and the translated attributes of each element', () => {
    const t = createTranslator((key) => `<${key}>`);
    const heading = element({ 'data-i18n': 'title' });
    const search = element({ 'data-i18n-placeholder': 'listSearch', 'data-i18n-aria-label': 'listSearch' });
    const button = element({ 'data-i18n-title': 'listOpenChannel' });
    translatePage(root([heading, search, button]), t);
    assert.equal(heading.textContent, '<title>');
    assert.equal(search.attributes.placeholder, '<listSearch>');
    assert.equal(search.attributes['aria-label'], '<listSearch>');
    assert.equal(button.attributes.title, '<listOpenChannel>');
  });
});

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
