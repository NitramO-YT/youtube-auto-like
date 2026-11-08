import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isChannelListed, isValidChannelId, MAX_CHANNELS, normalizeChannels } from '../../src/core/channels.js';

// Real IDs read in Brave on 8 November 2026: COLAS and Qoqsik.
const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const QOQSIK = 'UCfefITu3BR2ix7ZUSrxj16w';

describe('isValidChannelId', () => {
  it('accepts real channel IDs', () => {
    assert.ok(isValidChannelId(COLAS));
    assert.ok(isValidChannelId(QOQSIK));
  });

  for (const id of ['', '@COLAS.', 'https://www.youtube.com/channel/' + COLAS, COLAS.slice(0, -1), `${COLAS}x`, 'UC9orcd4I_3Uy_8_UAz2r4!g', null, 42]) {
    it(`rejects ${JSON.stringify(id)}`, () => assert.equal(isValidChannelId(id), false));
  }
});

describe('normalizeChannels', () => {
  it('returns an empty list for anything but an array', () => {
    for (const raw of [undefined, null, {}, 'list', 3]) assert.deepEqual(normalizeChannels(raw), []);
  });

  it('keeps valid entries in order, trims names and drops the rest', () => {
    assert.deepEqual(
      normalizeChannels([
        { id: QOQSIK, name: '  Qoqsik  ' },
        null,
        { id: 'invalid', name: 'x' },
        { id: COLAS },
        { id: COLAS, name: 'duplicate' },
        { id: QOQSIK, name: 42, extra: true },
      ]),
      [
        { id: QOQSIK, name: 'Qoqsik' },
        { id: COLAS, name: '' },
      ],
    );
  });

  it('cuts very long names and stops at the maximum count', () => {
    assert.equal(normalizeChannels([{ id: COLAS, name: 'a'.repeat(1000) }])[0].name.length, 200);
    const many = Array.from({ length: MAX_CHANNELS + 10 }, (_, i) => ({
      id: `UC${String(i).padStart(22, '0')}`,
      name: '',
    }));
    assert.equal(normalizeChannels(many).length, MAX_CHANNELS);
  });
});

describe('isChannelListed', () => {
  it('matches by channel ID only', () => {
    const channels = [{ id: COLAS, name: 'COLAS' }];
    assert.ok(isChannelListed(channels, COLAS));
    assert.equal(isChannelListed(channels, QOQSIK), false);
    assert.equal(isChannelListed(channels, 'COLAS'), false);
  });
});
