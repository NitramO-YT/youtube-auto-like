import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  channelFromPage,
  channelInputFromOembed,
  channelPageUrl,
  LinkKind,
  oembedUrl,
  parseChannelInput,
} from '../../src/core/channel-links.js';

const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const channelId = (id) => ({ kind: LinkKind.CHANNEL_ID, channelId: id });
const handle = (name) => ({ kind: LinkKind.HANDLE, handle: name });
const video = (id) => ({ kind: LinkKind.VIDEO, videoId: id });

describe('parseChannelInput', () => {
  it('reads a channel ID, alone or in a channel address, with any tab', () => {
    assert.deepEqual(parseChannelInput(`  ${COLAS} `), channelId(COLAS));
    assert.deepEqual(parseChannelInput(`https://www.youtube.com/channel/${COLAS}/videos`), channelId(COLAS));
    assert.deepEqual(parseChannelInput(`youtube.com/channel/${COLAS}`), channelId(COLAS));
  });

  it('reads a handle, alone or in an address', () => {
    assert.deepEqual(parseChannelInput('@COLAS.'), handle('@COLAS.'));
    assert.deepEqual(parseChannelInput('https://www.youtube.com/@COLAS./shorts'), handle('@COLAS.'));
    assert.deepEqual(parseChannelInput('https://m.youtube.com/@%C3%89lodie'), handle('@Élodie'));
  });

  it('reads a video, a Short, a live or a short link', () => {
    assert.deepEqual(parseChannelInput('https://www.youtube.com/watch?v=aeP4eG-gO10&t=42s'), video('aeP4eG-gO10'));
    assert.deepEqual(parseChannelInput('https://www.youtube.com/shorts/EkDC9elBHHc'), video('EkDC9elBHHc'));
    assert.deepEqual(parseChannelInput('https://www.youtube.com/live/aeP4eG-gO10'), video('aeP4eG-gO10'));
    assert.deepEqual(parseChannelInput('https://youtu.be/aeP4eG-gO10?si=x'), video('aeP4eG-gO10'));
  });

  it('refuses anything else', () => {
    for (const line of [
      '',
      'COLAS',
      '@',
      '@a b',
      'https://www.youtube.com/',
      'https://www.youtube.com/c/COLAS',
      'https://www.youtube.com/channel/nope',
      'https://www.youtube.com/watch?v=short',
      'https://music.youtube.com/@COLAS.',
      'https://evil.example/@COLAS.',
      'https://www.youtube.com.evil.example/@COLAS.',
      'javascript:alert(1)',
      `https://youtu.be/aeP4eG-gO10/more`,
      'x'.repeat(3000),
      null,
    ]) {
      assert.equal(parseChannelInput(line), null, String(line).slice(0, 60));
    }
  });
});

describe('addresses asked', () => {
  it('asks the channel page by ID or by handle, and oEmbed for a video', () => {
    assert.equal(channelPageUrl(channelId(COLAS)), `https://www.youtube.com/channel/${COLAS}`);
    assert.equal(channelPageUrl(handle('@COLAS.')), 'https://www.youtube.com/@COLAS.');
    assert.equal(channelPageUrl(handle('@Élodie')), 'https://www.youtube.com/@%C3%89lodie');
    assert.equal(oembedUrl('aeP4eG-gO10'), 'https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DaeP4eG-gO10');
  });
});

describe('channelFromPage', () => {
  // Tags as served on 9 November 2026, with a featured channel first.
  const page = (canonical, title = 'COLAS', image = 'https://yt3.googleusercontent.com/MVUN-H_w=s900-c-k-c0x00ffffff-no-rj') =>
    `<html><script>{"channelId":"UCBK2DclO34h6BDqqrh-drPw"}</script><meta property="og:title" content="${title}">` +
    `<meta property="og:image" content="${image}"><link rel="canonical" href="${canonical}"></html>`;

  it('reads the channel of the canonical address, its name and its avatar', () => {
    assert.deepEqual(channelFromPage(page(`https://www.youtube.com/channel/${COLAS}`, 'L&#39;atelier &amp; co')), {
      id: COLAS,
      name: "L'atelier & co",
      avatarUrl: 'https://yt3.googleusercontent.com/MVUN-H_w=s900-c-k-c0x00ffffff-no-rj',
    });
  });

  it('refuses a page whose canonical address is not a channel, and an avatar from elsewhere', () => {
    assert.equal(channelFromPage(page('https://www.youtube.com/watch?v=aeP4eG-gO10')), null);
    assert.equal(channelFromPage('<html></html>'), null);
    assert.equal(channelFromPage(null), null);
    assert.equal(channelFromPage(page(`https://www.youtube.com/channel/${COLAS}`, 'COLAS', 'https://evil.example/a.png')).avatarUrl, null);
  });
});

describe('channelInputFromOembed', () => {
  it('reads the channel of the author of a video', () => {
    assert.deepEqual(channelInputFromOembed({ author_name: 'COLAS', author_url: 'https://www.youtube.com/@COLAS.' }), handle('@COLAS.'));
    assert.deepEqual(channelInputFromOembed({ author_url: `https://www.youtube.com/channel/${COLAS}` }), channelId(COLAS));
  });

  it('refuses an answer without a channel address', () => {
    for (const answer of [null, 'x', {}, { author_url: 'https://evil.example/@x' }, { author_url: 'https://www.youtube.com/watch?v=aeP4eG-gO10' }]) {
      assert.equal(channelInputFromOembed(answer), null);
    }
  });
});
