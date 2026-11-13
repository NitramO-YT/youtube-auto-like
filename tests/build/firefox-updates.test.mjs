import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { UPDATE_URL, updatesManifest, xpiUrl } from '../../scripts/lib/firefox-updates.mjs';

const ID = 'youtube-auto-like@nitramo-yt.github.io';
const HASH = 'a'.repeat(64);

describe('Firefox update manifest', () => {
  it('names the signed package of the release, at the address of its tag, with its SHA-256', () => {
    assert.deepEqual(updatesManifest({ id: ID, version: '3.0.0', sha256: HASH }), {
      addons: {
        [ID]: {
          updates: [
            {
              version: '3.0.0',
              update_link: 'https://github.com/NitramO-YT/youtube-auto-like/releases/download/v3.0.0/youtube-auto-like.xpi',
              update_hash: `sha256:${HASH}`,
            },
          ],
        },
      },
    });
    assert.equal(xpiUrl('3.1.0'), 'https://github.com/NitramO-YT/youtube-auto-like/releases/download/v3.1.0/youtube-auto-like.xpi');
  });

  it('refuses what is not a SHA-256', () => {
    assert.throws(() => updatesManifest({ id: ID, version: '3.0.0', sha256: 'abc' }), /Not a SHA-256/);
  });

  it('stays at the address that versions 3.0.0 and 3.1.0 read', () => {
    assert.equal(UPDATE_URL, 'https://github.com/NitramO-YT/youtube-auto-like/releases/latest/download/updates.json');
  });

  it('is no longer named by the Firefox build, which addons.mozilla.org lists and updates', async () => {
    const overlay = JSON.parse(await readFile(new URL('../../src/manifest/firefox.json', import.meta.url), 'utf8'));
    assert.equal('update_url' in overlay.browser_specific_settings.gecko, false);
  });
});
