import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { injectIntoOpenTabs } from '../../src/background/inject.js';

const CONTENT_SCRIPTS = [
  { matches: ['https://www.youtube.com/*'], js: ['content/page.js'], world: 'MAIN' },
  { matches: ['https://www.youtube.com/*'], js: ['content/isolated.js'] },
];

function fakeApi(tabs, { failOn = null } = {}) {
  const calls = [];
  return {
    calls,
    runtime: { getManifest: () => ({ content_scripts: CONTENT_SCRIPTS }) },
    tabs: { query: mock.fn(async () => tabs) },
    scripting: {
      async executeScript(options) {
        if (options.target.tabId === failOn) throw new Error('Frame with ID 0 is showing error page');
        calls.push([options.target.tabId, options.files[0], options.world]);
      },
    },
  };
}

describe('injectIntoOpenTabs', () => {
  it('injects the page reader, then the liker, into each YouTube tab, in their worlds', async () => {
    const api = fakeApi([{ id: 1 }, { id: 2 }]);
    assert.equal(await injectIntoOpenTabs(api), 2);
    assert.deepEqual(api.tabs.query.mock.calls[0].arguments[0], { url: ['https://www.youtube.com/*'] });
    assert.deepEqual(api.calls, [
      [1, 'content/page.js', 'MAIN'],
      [1, 'content/isolated.js', 'ISOLATED'],
      [2, 'content/page.js', 'MAIN'],
      [2, 'content/isolated.js', 'ISOLATED'],
    ]);
  });

  it('skips a discarded tab, and goes on after a tab that refuses the scripts', async () => {
    const api = fakeApi([{ id: 1, discarded: true }, { id: 2 }, { id: 3 }], { failOn: 2 });
    const error = mock.method(console, 'error', () => {});
    try {
      assert.equal(await injectIntoOpenTabs(api), 1);
    } finally {
      error.mock.restore();
    }
    assert.deepEqual(api.calls.map(([tab]) => tab), [3, 3]);
  });
});
