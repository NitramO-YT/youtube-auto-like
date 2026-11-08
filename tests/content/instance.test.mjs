import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { claimInstance, isConnected } from '../../src/content/instance.js';

describe('claimInstance', () => {
  it('gives the turn to the newest copy only', () => {
    const world = {};
    const key = Symbol.for('youtube-auto-like:test');
    const older = claimInstance(world, key);
    assert.equal(older(), true);
    const newer = claimInstance(world, key);
    assert.equal(older(), false);
    assert.equal(newer(), true);
  });

  it('leaves the key out of what the page can list', () => {
    const world = {};
    claimInstance(world, Symbol.for('youtube-auto-like:test'));
    assert.deepEqual(Object.keys(world), []);
  });
});

describe('isConnected', () => {
  it('tells an extension still there from one that has been cut off', () => {
    assert.equal(isConnected({ runtime: { id: 'lccjnbjmgficoniieomponlgdjafnbhi' } }), true);
    assert.equal(isConnected({ runtime: { id: undefined } }), false);
    assert.equal(isConnected({ get runtime() { throw new Error('Extension context invalidated.'); } }), false);
    assert.equal(isConnected(undefined), false);
  });
});
