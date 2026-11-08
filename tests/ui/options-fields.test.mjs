import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeSettings } from '../../src/core/settings.js';
import { FIELDS, filterChannels, lockedThreshold, NUMBER_RANGES, validNumber } from '../../src/ui/options/fields.js';

const timing = (mode, percent, minutes) => ({ mode, percent: { enabled: percent, value: 50 }, minutes: { enabled: minutes, value: 2 } });

describe('FIELDS', () => {
  it('reads and writes each field without touching the others', () => {
    const settings = normalizeSettings({ timing: timing('custom', true, false) });
    for (const [name, value] of [
      ['enabled', false],
      ['likeWhat', 'all'],
      ['likeNormalVideos', false],
      ['likeShorts', false],
      ['timingMode', 'random'],
      ['percentEnabled', false],
      ['percentValue', 75],
      ['minutesEnabled', true],
      ['minutesValue', 2.5],
      ['lists', { always: [], never: [] }],
      ['theme', 'dark'],
    ]) {
      const changed = FIELDS[name].set(settings, value);
      assert.deepEqual(FIELDS[name].get(changed), value, name);
      assert.deepEqual(FIELDS[name].set(changed, FIELDS[name].get(settings)), settings, `${name}: setting the old value back undoes it`);
    }
  });
});

describe('validNumber', () => {
  it('accepts a number within the range of its field, bounds included', () => {
    assert.equal(validNumber(0, NUMBER_RANGES.percentValue), 0);
    assert.equal(validNumber(100, NUMBER_RANGES.percentValue), 100);
    assert.equal(validNumber(2.5, NUMBER_RANGES.minutesValue), 2.5);
  });

  it('refuses an empty field, a number out of range, or anything else', () => {
    for (const value of [Number.NaN, -1, 101, Number.POSITIVE_INFINITY, '50', null]) {
      assert.equal(validNumber(value, NUMBER_RANGES.percentValue), null, String(value));
    }
    assert.equal(validNumber(601, NUMBER_RANGES.minutesValue), null);
  });
});

describe('lockedThreshold', () => {
  it('locks the only threshold checked, in custom timing only', () => {
    assert.equal(lockedThreshold(timing('custom', true, false)), 'percent');
    assert.equal(lockedThreshold(timing('custom', false, true)), 'minutes');
    assert.equal(lockedThreshold(timing('custom', true, true)), null);
    assert.equal(lockedThreshold(timing('instant', true, false)), null);
  });
});

describe('filterChannels', () => {
  const channels = [
    { id: 'UC9orcd4I_3Uy_8_UAz2r48g', name: 'COLAS' },
    { id: 'UCfefITu3BR2ix7ZUSrxj16w', name: 'qoqsik' },
    { id: 'UCaaaaaaaaaaaaaaaaaaaaaa', name: 'Élodie Créations' },
  ];

  it('finds a channel by its name or its ID, ignoring case and accents', () => {
    assert.deepEqual(filterChannels(channels, 'colas').map((c) => c.name), ['COLAS']);
    assert.deepEqual(filterChannels(channels, ' elodie creations ').map((c) => c.name), ['Élodie Créations']);
    assert.deepEqual(filterChannels(channels, 'UCfefITu').map((c) => c.name), ['qoqsik']);
  });

  it('keeps every channel for an empty query, and none without a match', () => {
    assert.equal(filterChannels(channels, '  '), channels);
    assert.deepEqual(filterChannels(channels, 'zzz'), []);
  });
});
