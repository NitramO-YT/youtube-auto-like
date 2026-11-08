import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSnapshot } from '../../src/content/youtube/page-data.js';
import { element, fakeDocument } from '../helpers/fake-dom.mjs';

const PLAYER = 'ytd-player';
const SUBSCRIBE = 'ytd-watch-metadata ytd-subscribe-button-renderer';

// Shapes observed in Brave on 8 November 2026 (COLAS video aeP4eG-gO10).
const response = (overrides = {}) => ({
  videoDetails: { videoId: 'aeP4eG-gO10', channelId: 'UC9orcd4I_3Uy_8_UAz2r48g', author: 'COLAS', ...overrides.details },
  microformat: { playerMicroformatRenderer: { isShortsEligible: false, ...overrides.microformat } },
});

const playerReturning = (playerResponse) =>
  element({ props: { getPlayer: () => ({ getPlayerResponse: () => playerResponse }) } });

const page = ({ playerResponse = response(), subscribed = true } = {}) =>
  fakeDocument({
    [PLAYER]: playerReturning(playerResponse),
    [SUBSCRIBE]: element({ props: { data: { subscribed } } }),
  });

describe('readSnapshot', () => {
  it('reads a regular video of a subscribed channel', () => {
    assert.deepEqual(readSnapshot(page()), {
      videoId: 'aeP4eG-gO10',
      channelId: 'UC9orcd4I_3Uy_8_UAz2r48g',
      channelName: 'COLAS',
      isShort: false,
      isLive: false,
      subscribed: true,
    });
  });

  it('reads a Short, a live stream and a channel the user is not subscribed to', () => {
    const snapshot = readSnapshot(
      page({ playerResponse: response({ details: { isLive: true }, microformat: { isShortsEligible: true } }), subscribed: false }),
    );
    assert.equal(snapshot.isShort, true);
    assert.equal(snapshot.isLive, true);
    assert.equal(snapshot.subscribed, false);
  });

  it('gives null for whatever the page lacks, without throwing', () => {
    assert.deepEqual(readSnapshot(fakeDocument()), {
      videoId: null,
      channelId: null,
      channelName: '',
      isShort: null,
      isLive: null,
      subscribed: null,
    });
    const withoutMicroformat = readSnapshot(page({ playerResponse: { videoDetails: { videoId: 'aeP4eG-gO10' } } }));
    assert.equal(withoutMicroformat.isShort, null);
    assert.equal(withoutMicroformat.isLive, false);
  });

  it('survives a player that throws while being rebuilt', () => {
    const doc = fakeDocument({
      [PLAYER]: element({ props: { getPlayer: () => { throw new Error('player gone'); } } }),
    });
    assert.equal(readSnapshot(doc).videoId, null);
  });
});
