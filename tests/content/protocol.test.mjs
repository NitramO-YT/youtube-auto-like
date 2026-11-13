import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidVideoId, MAX_GUESTS, validateSnapshot } from '../../src/content/protocol.js';

// Kang et ses PC, guest of u5KEPWtwDiU (13 November 2026).
const GUEST = { id: 'UC3-dl8nKItitMxM9DNTDAfQ', name: 'Kang et ses PC', avatarUrl: 'https://yt3.ggpht.com/kang=s88-c-k-c0x00ffffff-no-rj' };

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
  guests: [GUEST],
  channelsTitle: 'COLAS et Kang et ses PC',
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
        guests: { 0: GUEST },
        channelsTitle: 42,
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
        guests: [],
        channelsTitle: '',
        likeAtLoad: { toggled: null, videoId: null },
        dislikeAtLoad: null,
      },
    );
  });

  describe('guests', () => {
    const guestsOf = (guests, snapshot = SNAPSHOT) => validateSnapshot({ ...snapshot, guests }).guests;

    it('keeps only guests with a valid channel ID, other than the channel of the video, each once', () => {
      const other = { ...GUEST, id: 'UCW-7TvXaVBhtzCivzhTP5zA', name: 'Le BENGE' };
      assert.deepEqual(
        guestsOf([null, 'UC3-dl8nKItitMxM9DNTDAfQ', { ...GUEST, id: '@kang' }, { ...GUEST, id: SNAPSHOT.channelId }, GUEST, GUEST, other]),
        [GUEST, other],
      );
    });

    it('cleans the name and the avatar of a guest as those of the channel', () => {
      assert.deepEqual(guestsOf([{ id: GUEST.id, name: 'n'.repeat(500), avatarUrl: 'https://evil.example/x.png', extra: true }]), [
        { id: GUEST.id, name: 'n'.repeat(200), avatarUrl: null },
      ]);
      assert.deepEqual(guestsOf([{ id: GUEST.id }]), [{ id: GUEST.id, name: '', avatarUrl: null }]);
    });

    it(`keeps at most ${MAX_GUESTS} guests`, () => {
      const many = Array.from({ length: MAX_GUESTS + 5 }, (_, index) => ({ id: `UC${String(index).padStart(22, '0')}`, name: `${index}` }));
      assert.equal(guestsOf(many).length, MAX_GUESTS);
    });

    it('keeps no guest without a valid channel for the video', () => {
      assert.deepEqual(guestsOf([GUEST], { ...SNAPSHOT, channelId: 'nope' }), []);
    });

    it('cuts an oversized title of the channels', () => {
      assert.equal(validateSnapshot({ ...SNAPSHOT, channelsTitle: 't'.repeat(5000) }).channelsTitle.length, 300);
    });
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
