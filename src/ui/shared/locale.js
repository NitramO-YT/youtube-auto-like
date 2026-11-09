/**
 * The language of the extension pages: the browser's (the i18n API), or the
 * one chosen in the settings. The i18n API always answers in the language
 * of the browser, so a chosen language is read from its own messages.json,
 * resolved with the same rules: $NAME$ becomes the content of its
 * placeholder, then $1 to $9 the substitution of that rank. A text missing
 * from it comes from the i18n API.
 */
import { AUTO_LANGUAGE, LOCALES } from '../../core/locales.js';
import { createTranslator } from './i18n.js';

const LOG_PREFIX = '[YouTube Auto Like]';

/** getMessage over the content of a messages.json; '' for a key it lacks. */
export function messagesResolver(messages) {
  return (key, substitutions = []) => {
    const entry = Object.hasOwn(messages, key) ? messages[key] : null;
    if (typeof entry?.message !== 'string') return '';
    const placeholders = Object.fromEntries(
      Object.entries(entry.placeholders ?? {}).map(([name, placeholder]) => [name.toLowerCase(), placeholder?.content ?? '']),
    );
    return entry.message
      .replace(/\$(\w+)\$/g, (match, name) => placeholders[name.toLowerCase()] ?? match)
      .replace(/\$([1-9])/g, (_, rank) => substitutions[rank - 1] ?? '');
  };
}

/**
 * { t, lang } for a language of the settings. A language that cannot be
 * read falls back to the browser's, and says so in the console.
 *
 * @param {object} api The extension API.
 * @param {string} language 'auto' or a key of LOCALES.
 */
export async function loadLanguage(api, language, fetchImpl = fetch) {
  const browser = (key, substitutions) => api.i18n.getMessage(key, substitutions);
  let getMessage = browser;
  if (language !== AUTO_LANGUAGE && Object.hasOwn(LOCALES, language)) {
    try {
      const response = await fetchImpl(api.runtime.getURL(`_locales/${language}/messages.json`));
      const chosen = messagesResolver(await response.json());
      getMessage = (key, substitutions) => chosen(key, substitutions) || browser(key, substitutions);
    } catch (error) {
      console.error(LOG_PREFIX, `could not load the language "${language}"`, error);
    }
  }
  const t = createTranslator(getMessage);
  return { t, lang: t('locale') };
}
