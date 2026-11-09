/**
 * The languages of the extension: one folder of src/_locales each (a test
 * checks that both agree). For the choice of the settings, each has its name
 * in itself and the country whose flag stands for it (ISO 3166-1 alpha-2).
 * "auto" follows the language of the browser.
 */
export const LOCALES = Object.freeze({
  de: Object.freeze({ name: 'Deutsch', region: 'DE' }),
  en: Object.freeze({ name: 'English', region: 'GB' }),
  es: Object.freeze({ name: 'Español', region: 'ES' }),
  fr: Object.freeze({ name: 'Français', region: 'FR' }),
  it: Object.freeze({ name: 'Italiano', region: 'IT' }),
  ja: Object.freeze({ name: '日本語', region: 'JP' }),
  nl: Object.freeze({ name: 'Nederlands', region: 'NL' }),
  pl: Object.freeze({ name: 'Polski', region: 'PL' }),
  pt_BR: Object.freeze({ name: 'Português (Brasil)', region: 'BR' }),
  ru: Object.freeze({ name: 'Русский', region: 'RU' }),
  sv: Object.freeze({ name: 'Svenska', region: 'SE' }),
  tr: Object.freeze({ name: 'Türkçe', region: 'TR' }),
  uk: Object.freeze({ name: 'Українська', region: 'UA' }),
});

export const AUTO_LANGUAGE = 'auto';
export const LANGUAGES = Object.freeze([AUTO_LANGUAGE, ...Object.keys(LOCALES)]);
