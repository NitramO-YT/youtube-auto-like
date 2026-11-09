/**
 * The languages of the extension: one folder of src/_locales each (a test
 * checks that both agree). For the choice of the settings, each has its name
 * in itself and the country whose flag stands for it (ISO 3166-1 alpha-2).
 * "auto" follows the language of the browser.
 */
export const LOCALES = Object.freeze({
  ar: Object.freeze({ name: 'العربية', region: 'SA' }),
  cs: Object.freeze({ name: 'Čeština', region: 'CZ' }),
  da: Object.freeze({ name: 'Dansk', region: 'DK' }),
  de: Object.freeze({ name: 'Deutsch', region: 'DE' }),
  en: Object.freeze({ name: 'English', region: 'GB' }),
  es: Object.freeze({ name: 'Español', region: 'ES' }),
  fi: Object.freeze({ name: 'Suomi', region: 'FI' }),
  fil: Object.freeze({ name: 'Filipino', region: 'PH' }),
  fr: Object.freeze({ name: 'Français', region: 'FR' }),
  hi: Object.freeze({ name: 'हिन्दी', region: 'IN' }),
  hu: Object.freeze({ name: 'Magyar', region: 'HU' }),
  id: Object.freeze({ name: 'Bahasa Indonesia', region: 'ID' }),
  it: Object.freeze({ name: 'Italiano', region: 'IT' }),
  ja: Object.freeze({ name: '日本語', region: 'JP' }),
  ko: Object.freeze({ name: '한국어', region: 'KR' }),
  nl: Object.freeze({ name: 'Nederlands', region: 'NL' }),
  pl: Object.freeze({ name: 'Polski', region: 'PL' }),
  pt_BR: Object.freeze({ name: 'Português (Brasil)', region: 'BR' }),
  ro: Object.freeze({ name: 'Română', region: 'RO' }),
  ru: Object.freeze({ name: 'Русский', region: 'RU' }),
  sk: Object.freeze({ name: 'Slovenčina', region: 'SK' }),
  sv: Object.freeze({ name: 'Svenska', region: 'SE' }),
  th: Object.freeze({ name: 'ไทย', region: 'TH' }),
  tr: Object.freeze({ name: 'Türkçe', region: 'TR' }),
  uk: Object.freeze({ name: 'Українська', region: 'UA' }),
  vi: Object.freeze({ name: 'Tiếng Việt', region: 'VN' }),
  zh_CN: Object.freeze({ name: '中文（简体）', region: 'CN' }),
  zh_TW: Object.freeze({ name: '中文（台灣）', region: 'TW' }),
});

export const AUTO_LANGUAGE = 'auto';
export const LANGUAGES = Object.freeze([AUTO_LANGUAGE, ...Object.keys(LOCALES)]);
