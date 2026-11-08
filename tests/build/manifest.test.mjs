import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assembleManifest, assertValidVersion, mergeManifest } from '../../scripts/lib/manifest.mjs';

describe('mergeManifest', () => {
  it('merges nested objects key by key, the overlay winning on conflicts', () => {
    const base = { name: 'base', background: { service_worker: 'sw.js', type: 'module' } };
    const overlay = { background: { type: 'classic' }, minimum_chrome_version: '120' };
    assert.deepEqual(mergeManifest(base, overlay), {
      name: 'base',
      background: { service_worker: 'sw.js', type: 'classic' },
      minimum_chrome_version: '120',
    });
  });

  it('replaces arrays instead of concatenating them', () => {
    const merged = mergeManifest({ permissions: ['storage', 'tabs'] }, { permissions: ['storage'] });
    assert.deepEqual(merged.permissions, ['storage']);
  });

  it('replaces an object with a scalar and the reverse', () => {
    assert.deepEqual(mergeManifest({ a: { b: 1 } }, { a: 2 }), { a: 2 });
    assert.deepEqual(mergeManifest({ a: 2 }, { a: { b: 1 } }), { a: { b: 1 } });
  });

  it('leaves both inputs unchanged', () => {
    const base = { background: { service_worker: 'sw.js' }, permissions: ['storage'] };
    const overlay = { background: { type: 'module' }, permissions: ['tabs'] };
    const baseCopy = structuredClone(base);
    const overlayCopy = structuredClone(overlay);
    const merged = mergeManifest(base, overlay);
    merged.permissions.push('alarms');
    merged.background.extra = true;
    assert.deepEqual(base, baseCopy);
    assert.deepEqual(overlay, overlayCopy);
  });
});

describe('assertValidVersion', () => {
  for (const version of ['3', '3.0', '3.0.0', '3.0.0.1', '65535.0.0']) {
    it(`accepts ${version}`, () => assertValidVersion(version));
  }
  for (const version of ['', '3.0.0-beta.1', 'v3.0.0', '3.0.0.0.1', '65536.0.0', '3..0', 3]) {
    it(`rejects ${JSON.stringify(version)}`, () => {
      assert.throws(() => assertValidVersion(version), /Invalid extension version/);
    });
  }
});

describe('assembleManifest', () => {
  it('adds the version from package.json to the merged manifest', () => {
    const manifest = assembleManifest({ base: { name: 'x' }, overlay: { a: 1 }, version: '3.0.0' });
    assert.deepEqual(manifest, { name: 'x', a: 1, version: '3.0.0' });
  });

  it('refuses a version set in the base or in the overlay', () => {
    assert.throws(
      () => assembleManifest({ base: { version: '1.0' }, overlay: {}, version: '3.0.0' }),
      /base manifest sets "version"/,
    );
    assert.throws(
      () => assembleManifest({ base: {}, overlay: { version: '1.0' }, version: '3.0.0' }),
      /overlay manifest sets "version"/,
    );
  });
});
