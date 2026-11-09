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

/** Languages written from right to left, by their primary subtag. */
const RIGHT_TO_LEFT = new Set(['ar', 'fa', 'he', 'ur']);

/** The dir attribute of a page in lang: 'rtl' or 'ltr'. */
export function directionOf(lang) {
  return RIGHT_TO_LEFT.has(String(lang).split(/[-_]/)[0].toLowerCase()) ? 'rtl' : 'ltr';
}

/** The flag emoji of a country (two regional indicator symbols). */
export function flagOf(region) {
  return String.fromCodePoint(...[...region.toUpperCase()].map((letter) => 0x1f1a5 + letter.charCodeAt(0)));
}

/**
 * How a language of the extension shows in the choice of the settings, for
 * a page in lang: "🇬🇧 Anglais - English", its flag, its name in lang (from
 * the browser, Intl.DisplayNames), then its name in itself; only the latter
 * when both are the same.
 */
export function languageLabel(code, lang) {
  const { name, region } = LOCALES[code];
  let local = null;
  try {
    local = new Intl.DisplayNames([lang], { type: 'language' }).of(code.replace('_', '-'));
  } catch {
    // A browser without the names of languages shows the name in itself only.
  }
  const shown = local ? local.charAt(0).toLocaleUpperCase(lang) + local.slice(1) : null;
  return shown && shown !== name ? `${flagOf(region)} ${shown} - ${name}` : `${flagOf(region)} ${name}`;
}

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
