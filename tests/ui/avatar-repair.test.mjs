import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HISTORY_KEY, SETTINGS_KEY, createStore } from '../../src/platform/storage.js';
import {
  channelsToLookUp,
  MAX_LOOKUPS,
  recentTries,
  repairMissingAvatars,
  RETRY_AFTER_MS,
  TRIED_KEY,
} from '../../src/ui/options/avatar-repair.js';
import { fakeStorageApi } from '../helpers/fake-storage.mjs';

const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const QOQSIK = 'UCfefITu3BR2ix7ZUSrxj16w';
const WAKED = 'UChQjbzNlo8xD154bJS3yb8A';
const AVATAR = 'https://yt3.googleusercontent.com/MVUN-H_w=s900-c-k-c0x00ffffff-no-rj';
const NOW = Date.parse('2026-11-12T10:00:00.000Z');

const pageOf = (channelId, avatarUrl) =>
  `<meta property="og:title" content="name"><meta property="og:image" content="${avatarUrl}">` +
  `<link rel="canonical" href="https://www.youtube.com/channel/${channelId}">`;

/** A fetch answering like YouTube for the channel pages given, and recording the addresses asked. */
function fakeYouTube(pages) {
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(url);
    const page = pages[url];
    if (page === undefined) throw new TypeError('Failed to fetch');
    return { ok: page.status === 200, status: page.status, text: async () => page.body };
  };
  return { fetchImpl, asked };
}

function fakeLocalStorage(initial = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
  };
}

const like = (videoId, channelId, channelAvatarUrl = null) => ({
  videoId,
  title: videoId,
  channelId,
  channelName: '',
  channelAvatarUrl,
  isShort: false,
  likedAt: '2026-11-11T20:00:00.000Z',
  removedAt: null,
});

describe('repairMissingAvatars', () => {
  it('looks up each channel without an avatar once, and gives the avatar found to all its entries', async () => {
    const api = fakeStorageApi({
      [SETTINGS_KEY]: { lists: { always: [{ id: COLAS, name: 'COLAS', addedAt: null }] } },
      [HISTORY_KEY]: [like('aeP4eG-gO10', COLAS), like('EkDC9elBHHc', COLAS)],
    });
    const { fetchImpl, asked } = fakeYouTube({
      [`https://www.youtube.com/channel/${COLAS}`]: { status: 200, body: pageOf(COLAS, AVATAR) },
    });
    const repaired = await repairMissingAvatars({ store: createStore(api), fetchImpl, storage: fakeLocalStorage(), now: () => NOW });
    assert.equal(repaired, 1);
    assert.deepEqual(asked, [`https://www.youtube.com/channel/${COLAS}`]);
    assert.equal(api.data[SETTINGS_KEY].lists.always[0].avatarUrl, AVATAR);
    assert.deepEqual(
      api.data[HISTORY_KEY].map((entry) => entry.channelAvatarUrl),
      [AVATAR, AVATAR],
    );
  });

  it('remembers a channel whose page gives no avatar, and does not ask for it again before a day', async () => {
    const api = fakeStorageApi({ [HISTORY_KEY]: [like('mvner5stHJc', WAKED), like('aeP4eG-gO10', COLAS)] });
    const storage = fakeLocalStorage();
    const pages = {
      [`https://www.youtube.com/channel/${WAKED}`]: { status: 404, body: '' },
      [`https://www.youtube.com/channel/${COLAS}`]: { status: 200, body: pageOf(COLAS, AVATAR) },
    };
    const first = fakeYouTube(pages);
    await repairMissingAvatars({ store: createStore(api), fetchImpl: first.fetchImpl, storage, now: () => NOW });
    assert.deepEqual(JSON.parse(storage.getItem(TRIED_KEY)), { [WAKED]: NOW });

    const sameDay = fakeYouTube(pages);
    await repairMissingAvatars({ store: createStore(api), fetchImpl: sameDay.fetchImpl, storage, now: () => NOW + 60_000 });
    assert.deepEqual(sameDay.asked, []);

    const nextDay = fakeYouTube(pages);
    await repairMissingAvatars({ store: createStore(api), fetchImpl: nextDay.fetchImpl, storage, now: () => NOW + RETRY_AFTER_MS });
    assert.deepEqual(nextDay.asked, [`https://www.youtube.com/channel/${WAKED}`]);
  });

  it('does not trust a page that answers for another channel', async () => {
    const api = fakeStorageApi({ [HISTORY_KEY]: [like('82DBD5efxMc', QOQSIK)] });
    const { fetchImpl } = fakeYouTube({ [`https://www.youtube.com/channel/${QOQSIK}`]: { status: 200, body: pageOf(COLAS, AVATAR) } });
    assert.equal(await repairMissingAvatars({ store: createStore(api), fetchImpl, now: () => NOW }), 0);
    assert.equal(api.data[HISTORY_KEY][0].channelAvatarUrl, null);
  });

  it('works without a localStorage, and asks nothing when no avatar is missing', async () => {
    const api = fakeStorageApi({ [HISTORY_KEY]: [like('aeP4eG-gO10', COLAS, AVATAR)] });
    const { fetchImpl, asked } = fakeYouTube({});
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    assert.equal(await repairMissingAvatars({ store: createStore(api), fetchImpl, storage: broken, now: () => NOW }), 0);
    assert.deepEqual(asked, []);
  });
});

describe('channelsToLookUp and recentTries', () => {
  it('skips the channels tried recently, and keeps at most MAX_LOOKUPS', () => {
    const ids = Array.from({ length: MAX_LOOKUPS + 5 }, (_, index) => `UC${String(index).padStart(22, '0')}`);
    const chosen = channelsToLookUp(ids, { [ids[0]]: NOW });
    assert.equal(chosen.length, MAX_LOOKUPS);
    assert.equal(chosen[0], ids[1]);
  });

  it('keeps only valid, recent tries', () => {
    assert.deepEqual(
      recentTries({ [COLAS]: NOW - 1000, [QOQSIK]: NOW - RETRY_AFTER_MS, [WAKED]: NOW + 1000, nope: NOW, [`${COLAS}x`]: NOW }, NOW),
      { [COLAS]: NOW - 1000 },
    );
    for (const raw of [null, 'text', [COLAS], { [COLAS]: 'yesterday' }]) assert.deepEqual(recentTries(raw, NOW), {}, JSON.stringify(raw));
  });
});
