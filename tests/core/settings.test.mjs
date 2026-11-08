import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultSettings, normalizeSettings, SETTINGS_SCHEMA_VERSION } from '../../src/core/settings.js';

const CHANNEL = 'UC9orcd4I_3Uy_8_UAz2r48g';

describe('defaultSettings', () => {
  it('returns a fresh copy each time', () => {
    const first = defaultSettings();
    first.enabled = false;
    first.lists.always.push({ id: CHANNEL, name: 'x', addedAt: null });
    assert.equal(defaultSettings().enabled, true);
    assert.deepEqual(defaultSettings().lists, { always: [], never: [] });
  });

  it('is already normalized', () => {
    assert.deepEqual(normalizeSettings(defaultSettings()), defaultSettings());
  });
});

describe('normalizeSettings', () => {
  it('returns the defaults for nothing or for a value that is not an object', () => {
    for (const raw of [undefined, null, 42, 'settings', [], true]) {
      assert.deepEqual(normalizeSettings(raw), defaultSettings(), `input ${JSON.stringify(raw)}`);
    }
  });

  it('keeps every valid value', () => {
    const custom = {
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      enabled: false,
      likeWhat: 'alwaysList',
      likeNormalVideos: false,
      likeShorts: false,
      lists: { always: [{ id: CHANNEL, name: 'COLAS', addedAt: '2026-11-08T21:00:00.000Z' }], never: [] },
      excludedVideos: [{ videoId: 'aeP4eG-gO10', title: 'Atelier', channelName: 'COLAS', isShort: false, addedAt: '2026-11-08T21:00:00.000Z' }],
      timing: { mode: 'custom', percent: { enabled: false, value: 0 }, minutes: { enabled: true, value: 600 } },
      updateCheckMinutes: 0,
      theme: 'dark',
    };
    assert.deepEqual(normalizeSettings(custom), custom);
  });

  it('accepts each theme', () => {
    for (const theme of ['system', 'light', 'dark']) {
      assert.equal(normalizeSettings({ theme }).theme, theme);
    }
  });

  it('accepts each base rule', () => {
    for (const likeWhat of ['subscribed', 'all', 'alwaysList']) {
      assert.equal(normalizeSettings({ likeWhat }).likeWhat, likeWhat);
    }
  });

  it('replaces each invalid value with its default, field by field', () => {
    const normalized = normalizeSettings({
      enabled: 'yes',
      likeWhat: 'none',
      likeShorts: false,
      timing: { mode: 'later', percent: { enabled: true, value: 101 }, minutes: { value: Number.NaN } },
      updateCheckMinutes: 3,
      theme: 'sepia',
    });
    const defaults = defaultSettings();
    assert.equal(normalized.theme, defaults.theme);
    assert.equal(normalized.enabled, defaults.enabled);
    assert.equal(normalized.likeWhat, defaults.likeWhat);
    assert.equal(normalized.likeShorts, false);
    assert.equal(normalized.timing.mode, defaults.timing.mode);
    assert.equal(normalized.timing.percent.value, defaults.timing.percent.value);
    assert.equal(normalized.timing.minutes.value, defaults.timing.minutes.value);
    assert.equal(normalized.updateCheckMinutes, 30, 'checks less than 5 minutes apart are refused');
  });

  it('drops unknown keys, including those of the single list of earlier designs', () => {
    const normalized = normalizeSettings({ list: { enabled: true, mode: 'allowlist' }, channels: [{ id: CHANNEL }], debug: true });
    for (const key of ['list', 'channels', 'debug']) assert.equal(key in normalized, false);
    assert.equal(normalized.schemaVersion, SETTINGS_SCHEMA_VERSION);
  });

  it('enables the percentage threshold of a custom timing that has none', () => {
    const normalized = normalizeSettings({
      timing: { mode: 'custom', percent: { enabled: false, value: 30 }, minutes: { enabled: false, value: 5 } },
    });
    assert.deepEqual(normalized.timing.percent, { enabled: true, value: 30 });
  });

  it('cleans the channel lists', () => {
    const normalized = normalizeSettings({ lists: { always: [{ id: CHANNEL, name: ' COLAS ' }, { id: 'nope' }], never: 'x' } });
    assert.deepEqual(normalized.lists, { always: [{ id: CHANNEL, name: 'COLAS', addedAt: null }], never: [] });
  });
});
