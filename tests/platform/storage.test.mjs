import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultSettings } from '../../src/core/settings.js';
import { createStore, HISTORY_KEY, JOURNAL_KEY, SETTINGS_KEY, STATS_KEY } from '../../src/platform/storage.js';
import { fakeStorageApi as fakeApi } from '../helpers/fake-storage.mjs';

const LIKE = {
  videoId: 'aeP4eG-gO10',
  title: "J'AI CONSTRUIT MON ATELIER DE RÊVE !",
  channelId: 'UC9orcd4I_3Uy_8_UAz2r48g',
  channelName: 'COLAS',
  channelAvatarUrl: 'https://yt3.googleusercontent.com/3fhLCThebQlwuSDXM9SEapaTSVFB3EuXHCKtDzFhnugoLLb71I05xsU_yi5-qLMoT0Ve4PQQ=s88-c-k-c0x00ffffff-no-rj-mo',
  isShort: false,
  likedAt: '2026-11-08T21:00:00.000Z',
  removedAt: null,
};

describe('createStore', () => {
  it('loads the defaults when nothing is stored', async () => {
    assert.deepEqual(await createStore(fakeApi()).loadSettings(), defaultSettings());
  });

  it('normalizes what it loads and what it saves', async () => {
    const api = fakeApi({ [SETTINGS_KEY]: { likeWhat: 'all', enabled: 'maybe' } });
    const store = createStore(api);
    const loaded = await store.loadSettings();
    assert.equal(loaded.likeWhat, 'all');
    assert.equal(loaded.enabled, true);

    await store.saveSettings({ likeShorts: false, injected: '<script>' });
    assert.equal(api.data[SETTINGS_KEY].likeShorts, false);
    assert.equal('injected' in api.data[SETTINGS_KEY], false);
  });

  it('passes normalized settings to change listeners, and ignores other keys', async () => {
    const api = fakeApi();
    const store = createStore(api);
    const received = [];
    store.onSettingsChange((settings) => received.push(settings));
    await api.storage.local.set({ [SETTINGS_KEY]: { likeWhat: 'all', unknown: 1 } });
    await api.storage.local.set({ other: 1 });
    assert.equal(received.length, 1);
    assert.equal(received[0].likeWhat, 'all');
    assert.equal('unknown' in received[0], false);
  });

  it('applies a change to the settings as stored, not to an older copy', async () => {
    const api = fakeApi();
    const store = createStore(api);
    const copyOfThePopup = await store.loadSettings();
    // Another page switches Shorts off after the popup loaded its copy.
    await store.saveSettings({ ...copyOfThePopup, likeShorts: false });
    const saved = await store.updateSettings((settings) => ({ ...settings, enabled: false }));
    assert.equal(saved.enabled, false);
    assert.equal(saved.likeShorts, false);
    assert.deepEqual(api.data[SETTINGS_KEY], saved);
  });

  it('passes the new like count to listeners, and ignores other keys', async () => {
    const api = fakeApi();
    const store = createStore(api);
    const received = [];
    store.onLikeCountChange((count) => received.push(count));
    await store.recordLike(LIKE);
    await api.storage.local.set({ [STATS_KEY]: { likeCount: 'many' } });
    await api.storage.local.set({ [SETTINGS_KEY]: {} });
    assert.deepEqual(received, [1, 0]);
  });

  it('counts likes, starting from zero or from a corrupted value', async () => {
    const store = createStore(fakeApi({ [STATS_KEY]: { likeCount: -3 } }));
    assert.equal(await store.loadLikeCount(), 0);
    assert.equal(await store.recordLike(LIKE), 1);
    assert.equal(await store.recordLike({ ...LIKE, videoId: 'EkDC9elBHHc' }), 2);
    assert.equal(await store.loadLikeCount(), 2);
  });

  it('adds each like to the history, newest first, in the same write as the count', async () => {
    const api = fakeApi({ [HISTORY_KEY]: [{ ...LIKE, likedAt: '2026-11-08T20:00:00.000Z' }, 'corrupted'] });
    const store = createStore(api);
    const writes = [];
    store.onHistoryChange((history) => writes.push(history.length));
    await store.recordLike({ ...LIKE, videoId: 'EkDC9elBHHc', isShort: true });
    assert.deepEqual((await store.loadHistory()).map((entry) => entry.videoId), ['EkDC9elBHHc', 'aeP4eG-gO10']);
    assert.equal(api.data[STATS_KEY].likeCount, 1);
    assert.deepEqual(writes, [2]);
  });

  it('loads a corrupted history as its valid entries only', async () => {
    const store = createStore(fakeApi({ [HISTORY_KEY]: [LIKE, 'text', { videoId: 'bad' }, { ...LIKE, script: '<img>' }] }));
    assert.deepEqual(await store.loadHistory(), [LIKE]);
    assert.deepEqual(await createStore(fakeApi({ [HISTORY_KEY]: 'not a list' })).loadHistory(), []);
  });

  it('replaces the history, keeping valid entries only', async () => {
    const store = createStore(fakeApi());
    assert.deepEqual(await store.setHistory([LIKE, { videoId: 'bad' }]), [LIKE]);
    assert.deepEqual(await store.setHistory([]), []);
    assert.deepEqual(await store.loadHistory(), []);
  });

  it('sets the like count, refusing what is not a count', async () => {
    const store = createStore(fakeApi());
    assert.equal(await store.setLikeCount(1248), 1248);
    assert.equal(await store.setLikeCount(-1), 0);
    assert.equal(await store.setLikeCount(2.5), 0);
    assert.equal(await store.loadLikeCount(), 0);
  });

  it('appends to the journal, keeps valid entries only, and replaces it', async () => {
    const api = fakeApi({ [JOURNAL_KEY]: [{ at: '2026-11-09T02:10:01.000Z', videoId: 'aeP4eG-gO10', text: 'opened (watch)' }, 'text'] });
    const store = createStore(api);
    const changes = [];
    store.onJournalChange((journal) => changes.push(journal.length));
    await store.appendJournal([{ at: '2026-11-09T02:10:04.000Z', videoId: 'aeP4eG-gO10', text: 'liked' }, { text: 'no date' }]);
    assert.deepEqual((await store.loadJournal()).map((entry) => entry.text), ['opened (watch)', 'liked']);
    await store.appendJournal([]);
    assert.deepEqual(changes, [2], 'an empty append writes nothing');
    assert.deepEqual(await store.setJournal([]), []);
    assert.deepEqual(await store.loadJournal(), []);
  });

  it('marks a like of the history as removed, and writes nothing when it has nothing to mark', async () => {
    const api = fakeApi({ [HISTORY_KEY]: [LIKE] });
    const store = createStore(api);
    const writes = [];
    store.onHistoryChange((history) => writes.push(history[0].removedAt));
    await store.markHistoryLike('aeP4eG-gO10', '2026-11-10T21:52:00.000Z');
    await store.markHistoryLike('aeP4eG-gO10', '2026-11-10T21:53:00.000Z');
    await store.markHistoryLike('EkDC9elBHHc', '2026-11-10T21:52:00.000Z');
    await store.markHistoryLike('aeP4eG-gO10', null);
    assert.deepEqual(writes, ['2026-11-10T21:52:00.000Z', null]);
  });

  describe('while the debug mode is on', () => {
    const AT = Date.parse('2026-11-09T18:00:00.000Z');
    const debugStore = (initial) => {
      const api = fakeApi(initial);
      const writes = [];
      const set = api.storage.local.set;
      api.storage.local.set = (items) => {
        writes.push(Object.keys(items).sort());
        return set(items);
      };
      return { api, writes, store: createStore(api, { source: 'popup', now: () => AT }) };
    };

    it('writes nothing in the journal while it is off', async () => {
      const { api, store } = debugStore();
      await store.updateSettings((settings) => ({ ...settings, theme: 'dark' }));
      await store.setLikeCount(0);
      await store.setHistory([]);
      assert.equal(JOURNAL_KEY in api.data, false);
    });

    it('notes a change of the settings, from the page that made it, in the same write', async () => {
      const { api, writes, store } = debugStore({ [JOURNAL_KEY]: [{ at: '2026-11-09T17:00:00.000Z', videoId: null, text: 'earlier' }] });
      await store.updateSettings((settings) => ({ ...settings, debug: true }));
      await store.updateSettings((settings) => ({ ...settings, likeWhat: 'all' }));
      assert.deepEqual(writes, [[JOURNAL_KEY, SETTINGS_KEY], [JOURNAL_KEY, SETTINGS_KEY]]);
      assert.deepEqual(api.data[JOURNAL_KEY], [
        { at: '2026-11-09T17:00:00.000Z', videoId: null, text: 'earlier' },
        { at: '2026-11-09T18:00:00.000Z', videoId: null, text: 'popup: setting debug: false -> true' },
        { at: '2026-11-09T18:00:00.000Z', videoId: null, text: 'popup: setting likeWhat: subscribed -> all' },
      ]);
    });

    it('stops noting once it is turned off, and notes nothing when nothing changed', async () => {
      const { api, store } = debugStore({ [SETTINGS_KEY]: { debug: true } });
      await store.updateSettings((settings) => settings);
      await store.updateSettings((settings) => ({ ...settings, debug: false }));
      assert.equal(JOURNAL_KEY in api.data, false);
    });

    it('notes a reset of the like count and a cleared history', async () => {
      const { api, store } = debugStore({ [SETTINGS_KEY]: { debug: true }, [STATS_KEY]: { likeCount: 37 }, [HISTORY_KEY]: [LIKE] });
      await store.setLikeCount(0);
      await store.setHistory([]);
      assert.deepEqual(api.data[JOURNAL_KEY].map((entry) => entry.text), ['popup: like count set to 0 (was 37)', 'popup: history set to 0 likes (was 1)']);
      assert.equal(api.data[STATS_KEY].likeCount, 0);
      assert.deepEqual(api.data[HISTORY_KEY], []);
    });
  });
});
