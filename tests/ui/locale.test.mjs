import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { LOCALES } from '../../src/core/locales.js';
import { directionOf, flagOf, languageLabel, loadLanguage, messagesResolver } from '../../src/ui/shared/locale.js';
import { fakeGetMessage, loadMessages } from '../helpers/fake-i18n.mjs';

// The extension API, answering in English like a browser in English.
const api = {
  i18n: { getMessage: fakeGetMessage('en') },
  runtime: { getURL: (file) => `chrome-extension://id/${file}` },
};
const fetchLocale = async (url) => {
  const locale = url.match(/_locales\/(\w+)\//)[1];
  return { json: async () => loadMessages(locale) };
};

describe('languageLabel', () => {
  it('shows the flag, the name in the page language, then the name in itself', () => {
    assert.equal(languageLabel('en', 'fr'), '🇬🇧 Anglais - English');
    assert.equal(languageLabel('fr', 'en'), '🇫🇷 French - Français');
  });

  it('shows the name once for the language of the page itself', () => {
    assert.equal(languageLabel('fr', 'fr'), '🇫🇷 Français');
    assert.equal(languageLabel('en', 'en'), '🇬🇧 English');
  });

  it('makes a flag of each country of the languages', () => {
    assert.equal(flagOf('gb'), '\u{1F1EC}\u{1F1E7}');
    for (const { region } of Object.values(LOCALES)) assert.equal([...flagOf(region)].length, 2, region);
  });
});

describe('directionOf', () => {
  it('writes Arabic from right to left, with or without a region', () => {
    assert.equal(directionOf('ar'), 'rtl');
    assert.equal(directionOf('ar-EG'), 'rtl');
  });

  it('writes the other languages from left to right', () => {
    assert.equal(directionOf('fr'), 'ltr');
    assert.equal(directionOf('zh-TW'), 'ltr');
    assert.equal(directionOf(''), 'ltr');
  });

  it('agrees with the browser data for every language of the extension', () => {
    for (const code of Object.keys(LOCALES)) {
      const lang = loadMessages(code).locale.message;
      assert.equal(directionOf(lang), new Intl.Locale(lang).getTextInfo().direction, code);
    }
  });
});

describe('messagesResolver', () => {
  it('resolves placeholders like the browser does', () => {
    const getMessage = messagesResolver(loadMessages('fr'));
    assert.equal(getMessage('aboutVersion', ['3.0.0']), 'YouTube Auto Like, version 3.0.0');
    assert.equal(getMessage('lookupMoved', ['A', 'B']), 'passera de « A » à « B »');
    assert.equal(getMessage('noSuchKey'), '');
    assert.equal(getMessage('__proto__'), '');
  });
});

describe('loadLanguage', () => {
  it('follows the browser with "auto", and reads a chosen language from its file', async () => {
    const auto = await loadLanguage(api, 'auto', fetchLocale);
    assert.equal(auto.lang, 'en');
    assert.equal(auto.t('navAbout'), 'About');
    const fr = await loadLanguage(api, 'fr', fetchLocale);
    assert.equal(fr.lang, 'fr');
    assert.equal(fr.t('navAbout'), 'À propos');
  });

  it('falls back to the browser for an unknown language or a file that cannot be read', async () => {
    assert.equal((await loadLanguage(api, 'xx', fetchLocale)).t('navAbout'), 'About');
    const error = mock.method(console, 'error', () => {});
    try {
      const broken = await loadLanguage(api, 'fr', async () => {
        throw new TypeError('Failed to fetch');
      });
      assert.equal(broken.t('navAbout'), 'About');
      assert.equal(error.mock.callCount(), 1);
    } finally {
      error.mock.restore();
    }
  });
});
