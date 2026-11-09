/**
 * The languages of the extension: one folder of src/_locales each (a test
 * checks that both agree), with its name in that language, for the choice
 * of the settings. "auto" follows the language of the browser.
 */
export const LOCALES = Object.freeze({
  en: 'English',
  fr: 'Français',
});

export const AUTO_LANGUAGE = 'auto';
export const LANGUAGES = Object.freeze([AUTO_LANGUAGE, ...Object.keys(LOCALES)]);
