import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { avatarUrl } from '../../src/core/avatar.js';

describe('avatarUrl', () => {
  it('keeps an https image of the avatar hosts', () => {
    assert.equal(avatarUrl('https://yt3.ggpht.com/abc=s88-c-k'), 'https://yt3.ggpht.com/abc=s88-c-k');
    assert.equal(avatarUrl('https://yt3.googleusercontent.com/abc'), 'https://yt3.googleusercontent.com/abc');
  });

  it('refuses any other address, and anything that is not a string', () => {
    for (const value of [
      'http://yt3.ggpht.com/x',
      'https://evil.example/x.png',
      'https://yt3.ggpht.com.evil.example/x',
      'https://user@evil.example/yt3.ggpht.com',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      `https://yt3.ggpht.com/${'a'.repeat(2100)}`,
      '',
      null,
      42,
    ]) {
      assert.equal(avatarUrl(value), null, String(value));
    }
  });
});
