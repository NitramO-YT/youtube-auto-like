import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isChannelListed,
  isValidChannelId,
  ListFullError,
  listOf,
  MAX_CHANNELS,
  mergeLists,
  normalizeChannels,
  normalizeLists,
  placeChannel,
} from '../../src/core/channels.js';

// Real IDs read in Brave on 8 November 2026: COLAS, Qoqsik and Waked XY.
const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const QOQSIK = 'UCfefITu3BR2ix7ZUSrxj16w';
const WAKED = 'UChQjbzNlo8xD154bJS3yb8A';
const NOW = '2026-11-08T21:00:00.000Z';

const manyChannels = (count) =>
  Array.from({ length: count }, (_, i) => ({ id: `UC${String(i).padStart(22, '0')}`, name: '' }));

describe('isValidChannelId', () => {
  it('accepts real channel IDs', () => {
    for (const id of [COLAS, QOQSIK, WAKED]) assert.ok(isValidChannelId(id));
  });

  for (const id of ['', '@COLAS.', 'https://www.youtube.com/channel/' + COLAS, COLAS.slice(0, -1), `${COLAS}x`, 'UC9orcd4I_3Uy_8_UAz2r4!g', null, 42]) {
    it(`rejects ${JSON.stringify(id)}`, () => assert.equal(isValidChannelId(id), false));
  }
});

describe('normalizeChannels', () => {
  it('returns an empty list for anything but an array', () => {
    for (const raw of [undefined, null, {}, 'list', 3]) assert.deepEqual(normalizeChannels(raw), []);
  });

  it('keeps valid entries in order, trims names, keeps valid dates and drops the rest', () => {
    assert.deepEqual(
      normalizeChannels([
        { id: QOQSIK, name: '  Qoqsik  ', addedAt: NOW },
        null,
        { id: 'invalid', name: 'x' },
        { id: COLAS, addedAt: 'not a date' },
        { id: COLAS, name: 'duplicate' },
        { id: QOQSIK, name: 42, extra: true },
      ]),
      [
        { id: QOQSIK, name: 'Qoqsik', addedAt: NOW },
        { id: COLAS, name: '', addedAt: null },
      ],
    );
  });

  it('cuts very long names and stops at the maximum count', () => {
    assert.equal(normalizeChannels([{ id: COLAS, name: 'a'.repeat(1000) }])[0].name.length, 200);
    assert.equal(normalizeChannels(manyChannels(MAX_CHANNELS + 10)).length, MAX_CHANNELS);
  });
});

describe('normalizeLists', () => {
  it('returns two empty lists for anything unusable', () => {
    for (const raw of [undefined, null, [], 'lists']) assert.deepEqual(normalizeLists(raw), { always: [], never: [] });
  });

  it('keeps a channel found in both lists in "never" only', () => {
    const lists = normalizeLists({ always: [{ id: COLAS }, { id: QOQSIK }], never: [{ id: COLAS }] });
    assert.deepEqual(lists.always.map((c) => c.id), [QOQSIK]);
    assert.deepEqual(lists.never.map((c) => c.id), [COLAS]);
  });
});

describe('isChannelListed and listOf', () => {
  const lists = { always: [{ id: COLAS, name: 'COLAS' }], never: [{ id: QOQSIK, name: 'qoqsik' }] };

  it('match by channel ID only', () => {
    assert.ok(isChannelListed(lists.always, COLAS));
    assert.equal(isChannelListed(lists.always, 'COLAS'), false);
    assert.equal(listOf(lists, COLAS), 'always');
    assert.equal(listOf(lists, QOQSIK), 'never');
    assert.equal(listOf(lists, WAKED), null);
  });
});

describe('placeChannel', () => {
  const empty = { always: [], never: [] };

  it('adds a channel at the top of a list, with the date of the change', () => {
    const lists = placeChannel({ always: [{ id: QOQSIK, name: 'qoqsik', addedAt: null }], never: [] }, { id: COLAS, name: 'COLAS' }, 'always', NOW);
    assert.deepEqual(lists.always, [
      { id: COLAS, name: 'COLAS', addedAt: NOW },
      { id: QOQSIK, name: 'qoqsik', addedAt: null },
    ]);
  });

  it('moves a channel from one list to the other', () => {
    const always = placeChannel(empty, { id: COLAS, name: 'COLAS' }, 'always', NOW);
    const never = placeChannel(always, { id: COLAS, name: 'COLAS' }, 'never', NOW);
    assert.deepEqual(never.always, []);
    assert.deepEqual(never.never.map((c) => c.id), [COLAS]);
  });

  it('removes a channel from both lists with target null', () => {
    const lists = placeChannel({ always: [{ id: COLAS, name: '', addedAt: null }], never: [] }, { id: COLAS }, null, NOW);
    assert.deepEqual(lists, empty);
  });

  it('keeps the place and date of a channel already in the target list, and refreshes its name', () => {
    const before = { always: [{ id: QOQSIK, name: 'q', addedAt: null }, { id: COLAS, name: 'old', addedAt: '2026-01-01T00:00:00.000Z' }], never: [] };
    const after = placeChannel(before, { id: COLAS, name: 'COLAS' }, 'always', NOW);
    assert.deepEqual(after.always[1], { id: COLAS, name: 'COLAS', addedAt: '2026-01-01T00:00:00.000Z' });
  });

  it('leaves its input unchanged', () => {
    const before = { always: [{ id: COLAS, name: 'COLAS', addedAt: null }], never: [] };
    const copy = structuredClone(before);
    placeChannel(before, { id: COLAS }, 'never', NOW);
    assert.deepEqual(before, copy);
  });

  it('refuses an invalid channel, an unknown list and a full list', () => {
    assert.throws(() => placeChannel(empty, { id: 'nope' }, 'always', NOW), /Invalid channel ID/);
    assert.throws(() => placeChannel(empty, { id: COLAS }, 'sometimes', NOW), /Unknown list/);
    assert.throws(() => placeChannel({ always: normalizeChannels(manyChannels(MAX_CHANNELS)), never: [] }, { id: COLAS }, 'always', NOW), ListFullError);
  });
});

describe('mergeLists', () => {
  const OLD = '2026-01-01T00:00:00.000Z';
  const current = normalizeLists({
    always: [{ id: COLAS, name: 'COLAS', addedAt: OLD }],
    never: [{ id: QOQSIK, name: 'qoqsik', addedAt: OLD }],
  });

  it('adds the imported channels in their order, with their dates, and keeps the others', () => {
    const imported = normalizeLists({ always: [{ id: WAKED, name: 'Waked XY', addedAt: OLD }, { id: 'UC' + '1'.repeat(22), name: 'One' }] });
    const { lists, added } = mergeLists(current, imported, NOW);
    assert.equal(added, 2);
    assert.deepEqual(lists.always.map((channel) => channel.id), [WAKED, 'UC' + '1'.repeat(22), COLAS]);
    assert.equal(lists.always[0].addedAt, OLD);
    assert.equal(lists.always[1].addedAt, NOW);
    assert.deepEqual(lists.never.map((channel) => channel.id), [QOQSIK]);
  });

  it('moves a channel to the list the import gives it, and does not count one already there', () => {
    const imported = normalizeLists({ always: [{ id: QOQSIK, name: 'qoqsik' }], never: [{ id: COLAS, name: 'COLAS' }] });
    const { lists, added } = mergeLists(current, imported, NOW);
    assert.equal(added, 2);
    assert.equal(listOf(lists, QOQSIK), 'always');
    assert.equal(listOf(lists, COLAS), 'never');
    assert.equal(mergeLists(current, current, NOW).added, 0);
  });

  it('merges nothing when a list would be full', () => {
    const full = { always: normalizeChannels(manyChannels(MAX_CHANNELS)), never: [] };
    assert.throws(() => mergeLists(full, normalizeLists({ always: [{ id: COLAS }] }), NOW), ListFullError);
  });
});
