import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultSettings } from '../../src/core/settings.js';
import { createStore, SETTINGS_KEY, STATS_KEY } from '../../src/platform/storage.js';

// storage.local and storage.onChanged as Chromium exposes them in Manifest V3.
function fakeApi(initial = {}) {
  const data = structuredClone(initial);
  const listeners = [];
  return {
    data,
    storage: {
      local: {
        async get(key) {
          return key in data ? { [key]: structuredClone(data[key]) } : {};
        },
        async set(items) {
          const changes = {};
          for (const [key, value] of Object.entries(items)) {
            changes[key] = { oldValue: data[key], newValue: structuredClone(value) };
            data[key] = structuredClone(value);
          }
          for (const listener of listeners) listener(changes, 'local');
        },
      },
      onChanged: { addListener: (listener) => listeners.push(listener) },
    },
  };
}

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

  it('counts likes, starting from zero or from a corrupted value', async () => {
    const store = createStore(fakeApi({ [STATS_KEY]: { likeCount: -3 } }));
    assert.equal(await store.loadLikeCount(), 0);
    assert.equal(await store.incrementLikeCount(), 1);
    assert.equal(await store.incrementLikeCount(), 2);
    assert.equal(await store.loadLikeCount(), 2);
  });
});
