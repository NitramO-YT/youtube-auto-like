/**
 * The real texts of src/_locales, through a stand-in for i18n.getMessage
 * that resolves placeholders the way the browser does: each $NAME$ of the
 * message becomes the content of its placeholder (case-insensitive name),
 * then each $1 to $9 becomes the substitution of that rank.
 *
 * Unlike the browser, which returns an empty string, an unknown key throws:
 * a test that reaches a missing text fails instead of passing silently.
 */
import { readFileSync } from 'node:fs';
import { createTranslator } from '../../src/ui/shared/i18n.js';

export const LOCALES = ['en', 'fr'];

export function loadMessages(locale) {
  return JSON.parse(readFileSync(new URL(`../../src/_locales/${locale}/messages.json`, import.meta.url), 'utf8'));
}

export function fakeGetMessage(locale) {
  const messages = loadMessages(locale);
  return (key, substitutions = []) => {
    const entry = messages[key];
    if (!entry) throw new Error(`No text "${key}" in ${locale}`);
    const placeholders = Object.fromEntries(
      Object.entries(entry.placeholders ?? {}).map(([name, placeholder]) => [name.toLowerCase(), placeholder.content]),
    );
    return entry.message
      .replace(/\$(\w+)\$/g, (match, name) => placeholders[name.toLowerCase()] ?? match)
      .replace(/\$([1-9])/g, (_, rank) => substitutions[rank - 1] ?? '');
  };
}

/** createTranslator over the real texts of locale. */
export function translator(locale) {
  return createTranslator(fakeGetMessage(locale));
}
