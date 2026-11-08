import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { findExecutable, injectScripts, readErrors } from '../../scripts/lib/preview.mjs';

describe('injectScripts', () => {
  it('loads the given scripts before the first script of the page', () => {
    const html = '<head><link rel="stylesheet" href="popup.css"></head><body><p>x</p><script src="popup.js"></script></body>';
    const result = injectScripts(html, ['data.js', '../../fake.js']);
    assert.ok(result.indexOf('src="data.js"') < result.indexOf('src="../../fake.js"'));
    assert.ok(result.indexOf('src="../../fake.js"') < result.indexOf('src="popup.js"'));
  });

  it('refuses a page without a script', () => {
    assert.throws(() => injectScripts('<p>no script</p>', ['data.js']), /no script/);
  });
});

describe('readErrors', () => {
  it('reads the errors kept on <html>, as the browser escapes them', () => {
    const dom = '<html lang="fr" data-preview-errors="[&quot;missing text &amp;quot;x&amp;quot;&quot;,&quot;a &lt; b&quot;]"><head>';
    assert.deepEqual(readErrors(dom), ['missing text &quot;x&quot;', 'a < b']);
    assert.deepEqual(readErrors('<html data-preview-errors="[]">'), []);
  });

  it('gives null when the stand-in API did not run', () => {
    assert.equal(readErrors('<html lang="en"><body></body></html>'), null);
  });
});

describe('findExecutable', () => {
  it('takes the first name found, in the order of the names, then of the folders', () => {
    const found = new Set([path.join('/b', 'chromium'), path.join('/a', 'brave-browser')]);
    const pathEnv = ['/a', '/b'].join(path.delimiter);
    assert.equal(findExecutable(['google-chrome', 'chromium', 'brave-browser'], pathEnv, (file) => found.has(file)), path.join('/b', 'chromium'));
    assert.equal(findExecutable(['google-chrome'], pathEnv, (file) => found.has(file)), null);
    assert.equal(findExecutable(['chromium'], undefined, () => true), null);
  });
});
