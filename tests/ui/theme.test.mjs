import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyTheme, bootTheme, THEME_KEY } from '../../src/ui/shared/theme.js';

function fakeDocument() {
  const attributes = {};
  return {
    attributes,
    documentElement: {
      setAttribute: (name, value) => (attributes[name] = value),
      removeAttribute: (name) => delete attributes[name],
    },
  };
}
const fakeStorage = (items = {}) => ({ items, getItem: (key) => items[key] ?? null, setItem: (key, value) => (items[key] = value) });
const refusing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };

describe('applyTheme', () => {
  it('sets a fixed theme on <html>, and none to follow the system', () => {
    const doc = fakeDocument();
    const storage = fakeStorage();
    applyTheme(doc, 'dark', storage);
    assert.equal(doc.attributes['data-theme'], 'dark');
    assert.equal(storage.items[THEME_KEY], 'dark');
    applyTheme(doc, 'system', storage);
    assert.equal('data-theme' in doc.attributes, false);
  });

  it('still applies the theme when the storage refuses the copy', () => {
    const doc = fakeDocument();
    applyTheme(doc, 'light', refusing);
    assert.equal(doc.attributes['data-theme'], 'light');
  });
});

describe('bootTheme', () => {
  it('opens the page in the theme kept by applyTheme', () => {
    const doc = fakeDocument();
    bootTheme(doc, fakeStorage({ [THEME_KEY]: 'light' }));
    assert.equal(doc.attributes['data-theme'], 'light');
  });

  it('follows the system without a copy, with an unknown value, or when storage is refused', () => {
    for (const storage of [fakeStorage(), fakeStorage({ [THEME_KEY]: 'sepia' }), refusing]) {
      const doc = fakeDocument();
      bootTheme(doc, storage);
      assert.equal('data-theme' in doc.attributes, false);
    }
  });
});
