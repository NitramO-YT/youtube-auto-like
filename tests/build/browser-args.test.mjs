import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { headlessArgs, packArgs } from '../../scripts/lib/browser-args.mjs';

describe('headlessArgs', () => {
  const args = headlessArgs('/tmp/profile', ['--dump-dom', 'file:///page.html']);

  it('starts a headless browser on the given profile, with extensions off', () => {
    assert.ok(args.includes('--headless=new'));
    assert.ok(args.includes('--user-data-dir=/tmp/profile'));
    assert.ok(args.includes('--disable-extensions'));
  });

  it('ends with what to load', () => {
    assert.deepEqual(args.slice(-2), ['--dump-dom', 'file:///page.html']);
  });
});

describe('packArgs', () => {
  const args = packArgs('/tmp/profile', '/build', '/key.pem');

  it('packs on the given profile, with extensions off', () => {
    assert.ok(args.includes('--user-data-dir=/tmp/profile'));
    assert.ok(args.includes('--disable-extensions'));
  });

  it('packs the build folder with the key', () => {
    assert.ok(args.includes('--pack-extension=/build'));
    assert.ok(args.includes('--pack-extension-key=/key.pem'));
  });
});
