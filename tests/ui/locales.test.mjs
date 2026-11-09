import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { LOCALES as EXTENSION_LOCALES } from '../../src/core/locales.js';
import { LOCALES, loadMessages } from '../helpers/fake-i18n.mjs';

// What would show a key instead of a text, or leave a translation behind.
const SRC = fileURLToPath(new URL('../../src/', import.meta.url));

function sourceFiles(dir, extensions) {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return name === '_locales' ? [] : sourceFiles(file, extensions);
    return extensions.includes(path.extname(name)) ? [file] : [];
  });
}

const read = (file) => readFileSync(file, 'utf8');
const placeholderNames = (entry) => Object.keys(entry.placeholders ?? {}).map((name) => name.toLowerCase()).sort();
const referencedNames = (message) => [...message.matchAll(/\$(\w+)\$/g)].map((match) => match[1].toLowerCase());

describe('locales', () => {
  const messages = Object.fromEntries(LOCALES.map((locale) => [locale, loadMessages(locale)]));
  const keys = Object.keys(messages.en).sort();

  it('are the languages offered in the settings, each named in itself', () => {
    assert.deepEqual(Object.keys(EXTENSION_LOCALES).sort(), LOCALES);
    for (const locale of LOCALES) assert.ok(messages[locale].locale?.message, `${locale} gives its locale`);
  });

  it('hold no em dash, a typographic choice of the project for every language', () => {
    for (const locale of LOCALES) {
      for (const [key, entry] of Object.entries(messages[locale])) assert.ok(!entry.message.includes('—'), `${locale} ${key}`);
    }
  });

  it('define the same keys, with the same placeholders, in every language', () => {
    for (const locale of LOCALES) {
      assert.deepEqual(Object.keys(messages[locale]).sort(), keys, locale);
      for (const key of keys) {
        assert.deepEqual(placeholderNames(messages[locale][key]), placeholderNames(messages.en[key]), `${locale}: ${key}`);
      }
    }
  });

  it('declare every placeholder a message uses, and use every one declared', () => {
    for (const locale of LOCALES) {
      for (const [key, entry] of Object.entries(messages[locale])) {
        assert.deepEqual([...new Set(referencedNames(entry.message))].sort(), placeholderNames(entry), `${locale}: ${key}`);
      }
    }
  });

  it('define every key used in the HTML of the pages', () => {
    for (const file of sourceFiles(SRC, ['.html'])) {
      for (const [, key] of read(file).matchAll(/data-i18n(?:-aria-label|-placeholder|-title)?="(\w+)"/g)) {
        assert.ok(messages.en[key], `${path.relative(SRC, file)} uses ${key}`);
      }
    }
  });

  it('define every key passed as such to t()', () => {
    for (const file of sourceFiles(path.join(SRC, 'ui'), ['.js'])) {
      for (const [, key] of read(file).matchAll(/\bt\('(\w+)'/g)) {
        assert.ok(messages.en[key], `${path.relative(SRC, file)} uses ${key}`);
      }
    }
  });

  it('hold no text that the sources never use', () => {
    const sources = sourceFiles(SRC, ['.js', '.html', '.json']).map(read).join('\n');
    for (const key of keys) {
      assert.ok(
        sources.includes(`'${key}'`) || sources.includes(`"${key}"`) || sources.includes(`__MSG_${key}__`),
        `${key} is never used`,
      );
    }
  });
});
