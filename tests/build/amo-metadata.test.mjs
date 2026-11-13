import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { listingProblems } from '../../scripts/lib/amo-metadata.mjs';

const listing = async () => JSON.parse(await readFile(new URL('../../store/amo-metadata.json', import.meta.url), 'utf8'));

describe('listing on addons.mozilla.org', () => {
  it('holds everything Mozilla asks for a first listed version', async () => {
    assert.deepEqual(listingProblems(await listing()), []);
  });

  it('gives the listing its address and the license of the project', async () => {
    const metadata = await listing();
    assert.equal(metadata.slug, 'youtube-auto-like-nitramo');
    assert.equal(metadata.version.license, 'MIT');
  });

  it('names each missing field', async () => {
    const metadata = await listing();
    const without = (change) => listingProblems({ ...metadata, ...change });
    assert.deepEqual(without({ summary: { fr: 'Résumé' } }), ['summary has no en-US text.']);
    assert.deepEqual(without({ name: { 'en-US': '  ' } }), ['name has no en-US text.']);
    assert.equal(without({ categories: { firefox: [] } }).length, 1);
    assert.equal(without({ categories: { android: ['other'] } }).length, 1);
    assert.equal(without({ version: { approval_notes: 'x' } }).length, 1);
    assert.deepEqual(listingProblems(null), ['The listing is not a JSON object.']);
  });

  it('refuses a slug the API refuses', async () => {
    const metadata = await listing();
    for (const slug of ['12345', 'with space', 'a/b', '', 42]) {
      assert.equal(listingProblems({ ...metadata, slug }).length, 1, String(slug));
    }
    for (const slug of ['youtube-auto-like-nitramo', 'a_b~c', 'v2']) {
      assert.deepEqual(listingProblems({ ...metadata, slug }), [], slug);
    }
  });

  it('has no em dash in its texts', async () => {
    assert.equal(JSON.stringify(await listing()).includes('—'), false);
  });
});

describe('screenshots of the listing', () => {
  it('each come from a store scenario, or the popups set side by side, with an English caption', async () => {
    const { SCENARIOS, STORE_SIZE } = await import('../../scripts/preview/scenarios.mjs');
    const shots = JSON.parse(await readFile(new URL('../../store/screenshots.json', import.meta.url), 'utf8'));
    assert.ok(shots.length > 0);
    const names = new Set(SCENARIOS.map((scenario) => scenario.name));
    for (const { file, scenario, caption } of shots) {
      assert.match(file, /^[\w-]+\.png$/);
      assert.ok(scenario === 'popups' || (names.has(scenario) && scenario.startsWith('store-')), scenario);
      if (scenario !== 'popups') assert.deepEqual(SCENARIOS.find((s) => s.name === scenario).size, STORE_SIZE, scenario);
      assert.ok(caption['en-US']?.trim(), file);
      assert.equal(JSON.stringify(caption).includes('—'), false, file);
    }
  });
});
