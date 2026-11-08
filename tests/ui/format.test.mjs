import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatAgo, formatClock, formatDuration, formatLikeCount } from '../../src/ui/shared/format.js';
import { translator } from '../helpers/fake-i18n.mjs';

const en = translator('en');
const fr = translator('fr');
const NBSP = ' ';

describe('formatClock', () => {
  it('writes playback times as YouTube does', () => {
    assert.equal(formatClock(0), '0:00');
    assert.equal(formatClock(562.9), '9:22');
    assert.equal(formatClock(1125), '18:45');
    assert.equal(formatClock(3723), '1:02:03');
  });
});

describe('formatDuration', () => {
  it('rounds up to the second, in words', () => {
    assert.equal(formatDuration(47.2, en), '48 s');
    assert.equal(formatDuration(348, en), '5 min 48 s');
    assert.equal(formatDuration(348, fr), `5${NBSP}min 48`);
    assert.equal(formatDuration(3900, fr), `1${NBSP}h 05${NBSP}min`);
  });

  it('never shows a negative duration', () => {
    assert.equal(formatDuration(-3, en), '0 s');
  });
});

describe('formatLikeCount', () => {
  it('follows the plural rules of the language', () => {
    assert.equal(formatLikeCount(1, 'en', en), '1 video liked');
    assert.equal(formatLikeCount(0, 'en', en), '0 videos liked');
    assert.equal(formatLikeCount(0, 'fr', fr), '0 vidéo likée');
    assert.equal(formatLikeCount(1248, 'en', en), '1,248 videos liked');
  });
});

describe('formatAgo', () => {
  it('picks the largest whole unit', () => {
    assert.equal(formatAgo(12_000, 'en'), '12 seconds ago');
    assert.equal(formatAgo(185_000, 'en'), '3 minutes ago');
    assert.equal(formatAgo(2 * 3600_000, 'en'), '2 hours ago');
  });
});
