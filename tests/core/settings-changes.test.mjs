import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_ITEM_LINES, settingsChanges } from '../../src/core/settings-changes.js';
import { normalizeSettings } from '../../src/core/settings.js';

const COLAS = { id: 'UC9orcd4I_3Uy_8_UAz2r48g', name: 'COLAS', addedAt: '2026-11-09T10:00:00.000Z' };
const QOQSIK = { id: 'UCfefITu3BR2ix7ZUSrxj16w', name: 'qoqsik', addedAt: '2026-11-09T10:00:00.000Z' };
const channel = (n) => ({ id: `UC${String(n).padStart(22, '0')}`, name: `Channel ${n}`, addedAt: '2026-11-09T10:00:00.000Z' });
const video = (videoId) => ({ videoId, title: 'A video', channelName: 'COLAS', isShort: false, addedAt: '2026-11-09T10:00:00.000Z' });
const texts = (lines) => lines.map((line) => line.text);

describe('settingsChanges', () => {
  it('finds nothing when nothing changed', () => {
    const settings = normalizeSettings({ lists: { always: [COLAS] }, excludedVideos: [video('aeP4eG-gO10')] });
    assert.deepEqual(settingsChanges(settings, normalizeSettings(structuredClone(settings))), []);
  });

  it('gives each setting changed, nested ones by their path, with the old and the new value', () => {
    const before = normalizeSettings({});
    const after = normalizeSettings({ enabled: false, theme: 'dark', timing: { mode: 'custom', percent: { enabled: true, value: 75 } } });
    assert.deepEqual(texts(settingsChanges(before, after)), [
      'setting enabled: true -> false',
      'setting timing.mode: instant -> custom',
      'setting timing.percent.value: 50 -> 75',
      'setting theme: system -> dark',
    ]);
    assert.ok(settingsChanges(before, after).every((line) => line.videoId === null));
  });

  it('names each channel added to or removed from a list, a move giving both', () => {
    const before = normalizeSettings({ lists: { always: [COLAS] } });
    const after = normalizeSettings({ lists: { always: [QOQSIK], never: [COLAS] } });
    assert.deepEqual(texts(settingsChanges(before, after)), [
      'channel UCfefITu3BR2ix7ZUSrxj16w "qoqsik" added to the always list',
      'channel UC9orcd4I_3Uy_8_UAz2r48g "COLAS" removed from the always list',
      'channel UC9orcd4I_3Uy_8_UAz2r48g "COLAS" added to the never list',
    ]);
  });

  it('gives each video excluded or no longer excluded, with its ID', () => {
    const before = normalizeSettings({ excludedVideos: [video('aeP4eG-gO10')] });
    const after = normalizeSettings({ excludedVideos: [video('82DBD5efxMc')] });
    assert.deepEqual(settingsChanges(before, after), [
      { videoId: '82DBD5efxMc', text: 'video excluded for good' },
      { videoId: 'aeP4eG-gO10', text: 'video no longer excluded' },
    ]);
  });

  it(`counts the channels or videos instead of listing them past ${MAX_ITEM_LINES}`, () => {
    const many = (count) => Array.from({ length: count }, (_, n) => channel(n));
    const before = normalizeSettings({});
    assert.equal(settingsChanges(before, normalizeSettings({ lists: { always: many(MAX_ITEM_LINES) } })).length, MAX_ITEM_LINES);
    assert.deepEqual(texts(settingsChanges(before, normalizeSettings({ lists: { always: many(MAX_ITEM_LINES + 1) } }))), [`${MAX_ITEM_LINES + 1} channels added to the always list`]);
    const videos = normalizeSettings({ excludedVideos: ['aaaaaaaaaa1', 'aaaaaaaaaa2', 'aaaaaaaaaa3', 'aaaaaaaaaa4', 'aaaaaaaaaa5', 'aaaaaaaaaa6'].map(video) });
    assert.deepEqual(texts(settingsChanges(videos, before)), ['6 videos no longer excluded']);
  });

  it('leaves out the schema version', () => {
    assert.deepEqual(settingsChanges({ ...normalizeSettings({}), schemaVersion: 0 }, normalizeSettings({})), []);
  });
});
