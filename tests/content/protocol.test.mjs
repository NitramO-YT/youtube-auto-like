import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidVideoId, validateSnapshot } from '../../src/content/protocol.js';

const SNAPSHOT = {
  videoId: 'aeP4eG-gO10',
  surfaceVideoId: 'aeP4eG-gO10',
  channelId: 'UC9orcd4I_3Uy_8_UAz2r48g',
  channelName: 'COLAS',
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
        channelId: '@COLAS.',
        channelName: { toString: () => 'x' },
        isShort: 'false',
        isLive: 0,
        subscribed: 'yes',
        likeAtLoad: { toggled: 'true', videoId: 'bad' },
        dislikeAtLoad: 'pressed',
      }),
      {
        videoId: SNAPSHOT.videoId,
        surfaceVideoId: null,
        channelId: null,
        channelName: '',
        isShort: null,
        isLive: null,
        subscribed: null,
        likeAtLoad: { toggled: null, videoId: null },
        dislikeAtLoad: null,
      },
    );
  });

  it('drops extra fields and cuts an oversized channel name', () => {
    const result = validateSnapshot({ ...SNAPSHOT, channelName: 'x'.repeat(5000), click: true, liked: false });
    assert.equal(result.channelName.length, 200);
    assert.equal('click' in result, false);
    assert.equal('liked' in result, false);
  });
});
