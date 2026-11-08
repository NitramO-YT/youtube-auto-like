import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { checkForUpdate } from '../../src/background/updates.js';
import { createStore } from '../../src/platform/storage.js';
import { fakeStorageApi } from '../helpers/fake-storage.mjs';

const NOW = Date.parse('2026-11-08T22:00:00.000Z');
const RELEASE = {
  tag_name: 'v3.1.0',
  html_url: 'https://github.com/NitramO-YT/youtube-auto-like/releases/tag/v3.1.0',
  prerelease: false,
  draft: false,
  published_at: '2026-12-01T10:00:00Z',
};
const LATEST = { version: '3.1.0', url: RELEASE.html_url, publishedAt: RELEASE.published_at };

const answer = (status, { json = null, headers = {} } = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: new Headers(headers),
  json: async () => {
    if (json === null) throw new SyntaxError('Unexpected end of JSON input');
    return json;
  },
});

function setup(initial = {}, response = answer(200, { json: RELEASE, headers: { ETag: 'W/"one"' } })) {
  const api = fakeStorageApi(initial);
  const fetch = mock.fn(async () => (response instanceof Error ? Promise.reject(response) : response));
  return { api, fetch, store: createStore(api) };
}

describe('checkForUpdate', () => {
  it('keeps the latest release and its ETag', async () => {
    const { fetch, store } = setup();
    const state = await checkForUpdate({ fetch, store, now: NOW });
    assert.deepEqual(state, { latest: LATEST, checkedAt: '2026-11-08T22:00:00.000Z', etag: 'W/"one"', retryAfter: null, failedAt: null });
    assert.equal(fetch.mock.calls[0].arguments[1].headers['If-None-Match'], undefined);
  });

  it('sends the ETag back, and keeps the release on a 304', async () => {
    const { fetch, store } = setup({ update: { latest: LATEST, checkedAt: '2026-11-08T21:00:00.000Z', etag: 'W/"one"' } }, answer(304));
    const state = await checkForUpdate({ fetch, store, now: NOW });
    assert.equal(fetch.mock.calls[0].arguments[1].headers['If-None-Match'], 'W/"one"');
    assert.deepEqual(state.latest, LATEST);
    assert.equal(state.checkedAt, '2026-11-08T22:00:00.000Z');
  });

  it('records that nothing is published on a 404', async () => {
    const { fetch, store } = setup({ update: { latest: LATEST, etag: 'W/"one"' } }, answer(404, { json: { message: 'Not Found' } }));
    const state = await checkForUpdate({ fetch, store, now: NOW });
    assert.equal(state.latest, null);
    assert.equal(state.checkedAt, '2026-11-08T22:00:00.000Z');
  });

  it('waits until the reset time GitHub gives when the limit is reached, without asking again', async () => {
    const reset = String(NOW / 1000 + 1800);
    const { fetch, store } = setup({}, answer(403, { headers: { 'X-RateLimit-Reset': reset } }));
    const error = mock.method(console, 'error', () => {});
    try {
      const refused = await checkForUpdate({ fetch, store, now: NOW });
      assert.equal(refused.retryAfter, '2026-11-08T22:30:00.000Z');
      await checkForUpdate({ fetch, store, now: NOW + 60_000 });
      assert.equal(fetch.mock.callCount(), 1, 'no request before the reset time');
      await checkForUpdate({ fetch, store, now: NOW + 1800_000 });
      assert.equal(fetch.mock.callCount(), 2);
    } finally {
      error.mock.restore();
    }
  });

  it('records a failure and keeps what it knew when GitHub cannot be reached', async () => {
    const { fetch, store } = setup({ update: { latest: LATEST } }, new TypeError('Failed to fetch'));
    const error = mock.method(console, 'error', () => {});
    try {
      const state = await checkForUpdate({ fetch, store, now: NOW });
      assert.deepEqual(state.latest, LATEST);
      assert.equal(state.failedAt, '2026-11-08T22:00:00.000Z');
      assert.equal(error.mock.callCount(), 1);
    } finally {
      error.mock.restore();
    }
  });

  it('ignores a release that is not a plain version of this repository', async () => {
    const { fetch, store } = setup({}, answer(200, { json: { ...RELEASE, html_url: 'https://evil.example/release' } }));
    assert.equal((await checkForUpdate({ fetch, store, now: NOW })).latest, null);
  });
});
