import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultSettings, normalizeSettings, SETTINGS_SCHEMA_VERSION } from '../../src/core/settings.js';

const CHANNEL = 'UC9orcd4I_3Uy_8_UAz2r48g';

describe('defaultSettings', () => {
  it('returns a fresh copy each time', () => {
    const first = defaultSettings();
    first.list.enabled = true;
    first.channels.push({ id: CHANNEL, name: 'x' });
    assert.equal(defaultSettings().list.enabled, false);
    assert.deepEqual(defaultSettings().channels, []);
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
      likeWhat: 'all',
      likeNormalVideos: false,
      likeShorts: false,
      list: { enabled: true, mode: 'allowlist', combine: 'or' },
      channels: [{ id: CHANNEL, name: 'COLAS' }],
      timing: { mode: 'custom', percent: { enabled: false, value: 0 }, minutes: { enabled: true, value: 600 } },
    };
    assert.deepEqual(normalizeSettings(custom), custom);
  });

  it('replaces each invalid value with its default, field by field', () => {
    const normalized = normalizeSettings({
      enabled: 'yes',
      likeWhat: 'none',
      likeShorts: false,
      list: { enabled: 1, mode: 'white', combine: 'and' },
      timing: { mode: 'later', percent: { enabled: true, value: 101 }, minutes: { value: Number.NaN } },
    });
    const defaults = defaultSettings();
    assert.equal(normalized.enabled, defaults.enabled);
    assert.equal(normalized.likeWhat, defaults.likeWhat);
    assert.equal(normalized.likeShorts, false);
    assert.deepEqual(normalized.list, { enabled: false, mode: 'blocklist', combine: 'and' });
    assert.equal(normalized.timing.mode, defaults.timing.mode);
    assert.equal(normalized.timing.percent.value, defaults.timing.percent.value);
    assert.equal(normalized.timing.minutes.value, defaults.timing.minutes.value);
  });

  it('drops unknown keys and always sets the current schema version', () => {
    const normalized = normalizeSettings({ like_what: 'all', schemaVersion: 99, debug: true });
    assert.equal(normalized.schemaVersion, SETTINGS_SCHEMA_VERSION);
    assert.equal('like_what' in normalized, false);
    assert.equal('debug' in normalized, false);
  });

  it('enables the percentage threshold of a custom timing that has none', () => {
    const normalized = normalizeSettings({
      timing: { mode: 'custom', percent: { enabled: false, value: 30 }, minutes: { enabled: false, value: 5 } },
    });
    assert.deepEqual(normalized.timing.percent, { enabled: true, value: 30 });
  });

  it('cleans the channel list', () => {
    const normalized = normalizeSettings({ channels: [{ id: CHANNEL, name: ' COLAS ' }, { id: 'nope' }] });
    assert.deepEqual(normalized.channels, [{ id: CHANNEL, name: 'COLAS' }]);
  });
});
