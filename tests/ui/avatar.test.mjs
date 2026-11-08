import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { initialOf, toneOf } from '../../src/ui/shared/avatar.js';

describe('initialOf', () => {
  it('takes the first letter of the name, in capitals', () => {
    assert.equal(initialOf('COLAS'), 'C');
    assert.equal(initialOf('  qoqsik'), 'Q');
    assert.equal(initialOf('élodie'), 'É');
  });

  it('keeps a character outside the basic plane whole', () => {
    assert.equal(initialOf('🎮 Gaming'), '🎮');
  });

  it('gives "?" without a name', () => {
    assert.equal(initialOf(''), '?');
    assert.equal(initialOf(null), '?');
  });
});

describe('toneOf', () => {
  it('gives the same color index to a channel every time, within the 8 tones', () => {
    const id = 'UC9orcd4I_3Uy_8_UAz2r48g';
    assert.equal(toneOf(id), toneOf(id));
    for (const other of ['UCa', 'UCb', 'UCc', id]) {
      assert.ok(Number.isInteger(toneOf(other)) && toneOf(other) >= 0 && toneOf(other) < 8);
    }
  });
});
