/**
 * Texts of the extension pages, from src/_locales through the i18n API.
 */

const LOG_PREFIX = '[YouTube Auto Like]';
// Marks a substitution inside a translated sentence, so that the sentence
// can be cut into plain and emphasized parts whatever the word order of the
// language. U+0001 never appears in a translation or in a substitution.
const MARK = '\u0001';

/**
 * @param {(key: string, substitutions: string[]) => string} getMessage
 *   api.i18n.getMessage, or a fake in tests.
 * @returns {(key: string, substitutions?: unknown[]) => string} A missing
 *   text shows its key, and is reported in the console.
 */
export function createTranslator(getMessage) {
  return (key, substitutions = []) => {
    const text = getMessage(key, substitutions.map(String));
    if (text) return text;
    console.error(LOG_PREFIX, `missing text "${key}"`);
    return key;
  };
}

/**
 * Fills the elements of root that carry data-i18n (text) or
 * data-i18n-aria-label (accessible name) with the text of that key.
 */
export function translatePage(root, t) {
  for (const element of root.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of root.querySelectorAll('[data-i18n-aria-label]')) {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
  }
}

/**
 * The sentence of key, cut into parts: the substitutions are emphasized
 * ({ text, strong: true }), the rest is not.
 */
export function emphasized(t, key, values) {
  const pieces = t(key, values.map((_, index) => `${MARK}${index}${MARK}`)).split(MARK);
  return pieces
    .map((piece, index) => (index % 2 === 0 ? { text: piece, strong: false } : { text: String(values[Number(piece)]), strong: true }))
    .filter((part) => part.text !== '');
}
