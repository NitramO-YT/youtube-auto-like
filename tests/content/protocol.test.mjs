import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidVideoId, validateSnapshot } from '../../src/content/protocol.js';

const SNAPSHOT = {
  videoId: 'aeP4eG-gO10',
  surfaceVideoId: 'aeP4eG-gO10',
  title: "J'AI CONSTRUIT MON ATELIER DE RÊVE !",
  channelId: 'UC9orcd4I_3Uy_8_UAz2r48g',
  channelName: 'COLAS',
  avatarUrl: 'https://yt3.ggpht.com/MVUN-H_w-0QKeMUYdDNiS3NA0cvA8mWGPHNzgTdxvplCbszxBKH-4smhoBfc9GBiI0j8Riu7AA=s88-c-k-c0x00ffffff-no-rj',
  signedIn: true,
  isShort: false,
  isLive: false,
  subscribed: true,
  likeAtLoad: { toggled: true, videoId: 'aeP4eG-gO10' },
  dislikeAtLoad: { toggled: false, videoId: 'aeP4eG-gO10' },
};

describe('isValidVideoId', () => {
  it('accepts real video IDs', () => {
    for (const id of ['aeP4eG-gO10', '82DBD5efxMc', 'JgL5gMtA2X4', 'n_b9qMDtYRo']) assert.ok(isValidVideoId(id));
  });
  for (const id of ['', 'aeP4eG-gO1', 'aeP4eG-gO100', 'aeP4eG gO10', 'aeP4eG/gO10', null, 11]) {
    it(`rejects ${JSON.stringify(id)}`, () => assert.equal(isValidVideoId(id), false));
  }
});

describe('validateSnapshot', () => {
  it('keeps a well-formed snapshot as is', () => {
    assert.deepEqual(validateSnapshot(SNAPSHOT), SNAPSHOT);
  });

  it('rejects anything without a valid video ID', () => {
    for (const payload of [null, undefined, 'snapshot', 42, {}, { ...SNAPSHOT, videoId: 'nope' }]) {
      assert.equal(validateSnapshot(payload), null);
    }
  });

  it('turns each invalid field into null instead of passing it on', () => {
    assert.deepEqual(
      validateSnapshot({
        videoId: SNAPSHOT.videoId,
        surfaceVideoId: 'not an id',
        title: ['<b>', 'title</b>'],
        channelId: '@COLAS.',
        channelName: { toString: () => 'x' },
        avatarUrl: { href: SNAPSHOT.avatarUrl },
        signedIn: 'false',
        isShort: 'false',
        isLive: 0,
        subscribed: 'yes',
        likeAtLoad: { toggled: 'true', videoId: 'bad' },
        dislikeAtLoad: 'pressed',
      }),
      {
        videoId: SNAPSHOT.videoId,
        surfaceVideoId: null,
        title: '',
        channelId: null,
        channelName: '',
        avatarUrl: null,
        signedIn: null,
        isShort: null,
        isLive: null,
        subscribed: null,
        likeAtLoad: { toggled: null, videoId: null },
        dislikeAtLoad: null,
      },
    );
  });

  it('keeps an avatar only when it is an https image of the servers of YouTube', () => {
    for (const avatarUrl of [
      'http://yt3.ggpht.com/x',
      'https://evil.example/x.png',
      'https://yt3.ggpht.com.evil.example/x',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      `https://yt3.ggpht.com/${'x'.repeat(400)}`,
      '',
    ]) {
      assert.equal(validateSnapshot({ ...SNAPSHOT, avatarUrl }).avatarUrl, null, avatarUrl);
    }
  });

  it('drops extra fields and cuts an oversized channel name or title', () => {
    const result = validateSnapshot({ ...SNAPSHOT, channelName: 'x'.repeat(5000), title: 'y'.repeat(5000), click: true, liked: false });
    assert.equal(result.channelName.length, 200);
    assert.equal(result.title.length, 300);
    assert.equal('click' in result, false);
    assert.equal('liked' in result, false);
  });
});
