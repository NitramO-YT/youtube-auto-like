import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { embeddedOptionsUrl, isEmbedded } from '../../src/ui/shared/embed.js';

describe('embedded options page', () => {
  it('points the frame of the popup to the options page with ?embedded', () => {
    const getURL = (path) => `chrome-extension://lccjnbjmgficoniieomponlgdjafnbhi/${path}`;
    assert.equal(embeddedOptionsUrl(getURL), 'chrome-extension://lccjnbjmgficoniieomponlgdjafnbhi/ui/options/options.html?embedded');
  });

  it('recognizes the embedded page by its address only', () => {
    assert.equal(isEmbedded(new URL('chrome-extension://id/ui/options/options.html?embedded')), true);
    assert.equal(isEmbedded(new URL('chrome-extension://id/ui/options/options.html')), false);
    assert.equal(isEmbedded(new URL('chrome-extension://id/ui/options/options.html#embedded')), false);
  });
});
