import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  availableUpdate,
  isNewer,
  isValidCheckFrequency,
  normalizeUpdateState,
  parseLatestRelease,
  parseVersion,
  updatesItself,
} from '../../src/core/update.js';

// Shape of the GitHub API answer, as read on 8 November 2026 for
// austencm/youtube-auto-like, with this repository's address.
const release = (overrides = {}) => ({
  tag_name: 'v3.1.0',
  html_url: 'https://github.com/NitramO-YT/youtube-auto-like/releases/tag/v3.1.0',
  prerelease: false,
  draft: false,
  published_at: '2026-12-01T10:00:00Z',
  ...overrides,
});

describe('versions', () => {
  it('reads plain versions, with or without a v', () => {
    assert.deepEqual(parseVersion('v3.1.0'), [3, 1, 0]);
    assert.deepEqual(parseVersion('3.0.12'), [3, 0, 12]);
    for (const text of ['3.1', '3.1.0-beta.1', 'v3.1.0.1', 'latest', '', null]) assert.equal(parseVersion(text), null, String(text));
  });

  it('compares versions number by number', () => {
    assert.equal(isNewer('3.1.0', '3.0.9'), true);
    assert.equal(isNewer('3.0.10', '3.0.9'), true);
    assert.equal(isNewer('3.0.0', '3.0.0'), false);
    assert.equal(isNewer('2.8.1', '3.0.0'), false);
    assert.equal(isNewer('nope', '3.0.0'), false);
  });
});

describe('isValidCheckFrequency', () => {
  it('accepts never, and whole numbers of minutes from 5 minutes to 30 days', () => {
    for (const minutes of [0, 5, 30, 90, 43200]) assert.equal(isValidCheckFrequency(minutes), true, String(minutes));
    for (const minutes of [1, 4, 43201, 7.5, -30, '30', null]) assert.equal(isValidCheckFrequency(minutes), false, String(minutes));
  });
});

describe('parseLatestRelease', () => {
  it('keeps the version, the page and the date of a release of this repository', () => {
    assert.deepEqual(parseLatestRelease(release()), {
      version: '3.1.0',
      url: 'https://github.com/NitramO-YT/youtube-auto-like/releases/tag/v3.1.0',
      publishedAt: '2026-12-01T10:00:00Z',
    });
  });

  it('refuses a draft, a pre-release, another tag, or a page elsewhere', () => {
    for (const overrides of [
      { draft: true },
      { prerelease: true },
      { tag_name: 'v3.1.0-beta.1' },
      { html_url: 'https://github.com/austencm/youtube-auto-like/releases/tag/v3.1.0' },
      { html_url: 'https://evil.example/NitramO-YT/youtube-auto-like/releases/' },
      { html_url: 'javascript:alert(1)//https://github.com/NitramO-YT/youtube-auto-like/releases/' },
    ]) {
      assert.equal(parseLatestRelease(release(overrides)), null, JSON.stringify(overrides));
    }
    assert.equal(parseLatestRelease({ message: 'Not Found' }), null);
  });
});

describe('update state', () => {
  it('keeps a valid state, and turns anything invalid into null', () => {
    const state = normalizeUpdateState({
      latest: { version: '3.1.0', url: 'https://github.com/NitramO-YT/youtube-auto-like/releases/tag/v3.1.0', publishedAt: null },
      checkedAt: '2026-11-08T22:00:00.000Z',
      etag: 'W/"abc"',
      retryAfter: 'later',
      failedAt: 42,
    });
    assert.equal(state.latest.version, '3.1.0');
    assert.equal(state.etag, 'W/"abc"');
    assert.equal(state.retryAfter, null);
    assert.equal(state.failedAt, null);
    assert.deepEqual(normalizeUpdateState('nope'), { latest: null, checkedAt: null, etag: null, retryAfter: null, failedAt: null });
  });

  it('tells about a release newer than the version installed only', () => {
    const state = normalizeUpdateState({ latest: { version: '3.1.0', url: 'https://github.com/NitramO-YT/youtube-auto-like/releases/tag/v3.1.0' } });
    assert.equal(availableUpdate(state, '3.0.0').version, '3.1.0');
    assert.equal(availableUpdate(state, '3.1.0'), null);
    assert.equal(availableUpdate(normalizeUpdateState({}), '3.0.0'), null);
  });
});

describe('updatesItself', () => {
  const layer = async (name) => JSON.parse(await readFile(new URL(`../../src/manifest/${name}.json`, import.meta.url), 'utf8'));

  it('is true for the Firefox package, which has a Gecko ID, and false for Chromium', async () => {
    assert.equal(updatesItself(await layer('firefox')), true);
    assert.equal(updatesItself({ ...(await layer('base')), ...(await layer('chromium')) }), false);
  });

  it('is false for a manifest without a Gecko ID', () => {
    for (const manifest of [undefined, {}, { browser_specific_settings: {} }, { browser_specific_settings: { gecko: { id: 42 } } }]) {
      assert.equal(updatesItself(manifest), false, JSON.stringify(manifest));
    }
  });
});
