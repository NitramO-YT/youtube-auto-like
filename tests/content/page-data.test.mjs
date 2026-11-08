import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSnapshot, shortsSubscription } from '../../src/content/youtube/page-data.js';
import { Surface } from '../../src/content/youtube/surface.js';
import { element, fakeDocument } from '../helpers/fake-dom.mjs';

// Shapes observed in Brave on 8 November 2026.
const response = (videoId, overrides = {}) => ({
  videoDetails: { videoId, channelId: 'UC9orcd4I_3Uy_8_UAz2r48g', author: 'COLAS', ...overrides.details },
  microformat: { playerMicroformatRenderer: { isShortsEligible: false, ...overrides.microformat } },
});

const watchPage = ({ playerResponse = response('aeP4eG-gO10'), surfaceVideoId = 'aeP4eG-gO10', subscribed = true } = {}) =>
  fakeDocument({
    'ytd-watch-flexy ytd-player': element({ props: { getPlayer: () => ({ getPlayerResponse: () => playerResponse }) } }),
    'ytd-watch-flexy': element({ attributes: surfaceVideoId === null ? {} : { 'video-id': surfaceVideoId } }),
    'ytd-watch-metadata ytd-subscribe-button-renderer': element({ props: { data: { subscribed } } }),
  });

const channelBar = ({ listsButton, buttonClasses = [] }) =>
  element({
    props: { data: listsButton ? { channelName: 'qoqsik', subscribeButtonViewModel: {} } : { channelName: '@COLAS.' } },
    children: listsButton ? { 'yt-subscribe-button-view-model button': element({ classes: buttonClasses }) } : {},
  });

const short = (videoId, bar) =>
  element({
    props: { data: { command: { reelWatchEndpoint: { videoId } } } },
    children: bar ? { 'yt-reel-channel-bar-view-model': bar } : {},
  });

const shortsPage = ({ videoId = 'JgL5gMtA2X4', shortVideoId = videoId, bar = channelBar({ listsButton: false }) } = {}) =>
  fakeDocument({
    '#shorts-player': element({
      props: { getPlayerResponse: () => response(videoId, { microformat: { isShortsEligible: true } }) },
      ancestors: { 'ytd-reel-video-renderer': short(shortVideoId, bar) },
    }),
  });

describe('readSnapshot on the watch page', () => {
  it('reads a regular video of a subscribed channel', () => {
    assert.deepEqual(readSnapshot(watchPage(), Surface.WATCH), {
      videoId: 'aeP4eG-gO10',
      surfaceVideoId: 'aeP4eG-gO10',
      channelId: 'UC9orcd4I_3Uy_8_UAz2r48g',
      channelName: 'COLAS',
      isShort: false,
      isLive: false,
      subscribed: true,
    });
  });

  it('reads a Short redirected to the watch page, a live stream, and a channel not subscribed to', () => {
    const snapshot = readSnapshot(
      watchPage({
        playerResponse: response('JgL5gMtA2X4', { details: { isLive: true }, microformat: { isShortsEligible: true } }),
        subscribed: false,
      }),
      Surface.WATCH,
    );
    assert.equal(snapshot.isShort, true);
    assert.equal(snapshot.isLive, true);
    assert.equal(snapshot.subscribed, false);
  });

  it('gives null for whatever the page lacks, without throwing', () => {
    assert.deepEqual(readSnapshot(fakeDocument(), Surface.WATCH), {
      videoId: null,
      surfaceVideoId: null,
      channelId: null,
      channelName: '',
      isShort: null,
      isLive: null,
      subscribed: null,
    });
  });

  it('survives a player that throws while being rebuilt', () => {
    const doc = fakeDocument({
      'ytd-watch-flexy ytd-player': element({ props: { getPlayer: () => { throw new Error('player gone'); } } }),
    });
    assert.equal(readSnapshot(doc, Surface.WATCH).videoId, null);
  });
});

describe('readSnapshot in the Shorts player', () => {
  it('reads the Short that holds the player, from the Shorts player', () => {
    assert.deepEqual(readSnapshot(shortsPage(), Surface.SHORTS), {
      videoId: 'JgL5gMtA2X4',
      surfaceVideoId: 'JgL5gMtA2X4',
      channelId: 'UC9orcd4I_3Uy_8_UAz2r48g',
      channelName: 'COLAS',
      isShort: true,
      isLive: false,
      subscribed: true,
    });
  });

  it('reports the Short shown separately from the player, so that a mismatch is visible', () => {
    const snapshot = readSnapshot(shortsPage({ shortVideoId: 'trLwaRWXeJY' }), Surface.SHORTS);
    assert.equal(snapshot.videoId, 'JgL5gMtA2X4');
    assert.equal(snapshot.surfaceVideoId, 'trLwaRWXeJY');
  });

  it('ignores the watch page hidden behind the Shorts player', () => {
    const doc = shortsPage();
    const hiddenWatch = watchPage({ playerResponse: response('aeP4eG-gO10') });
    const combined = fakeDocument({
      '#shorts-player': doc.querySelector('#shorts-player'),
      'ytd-watch-flexy ytd-player': hiddenWatch.querySelector('ytd-watch-flexy ytd-player'),
    });
    assert.equal(readSnapshot(combined, Surface.SHORTS).videoId, 'JgL5gMtA2X4');
  });
});

describe('readSnapshot without a video surface', () => {
  it('returns null', () => {
    assert.equal(readSnapshot(watchPage(), null), null);
  });
});

describe('shortsSubscription', () => {
  const inShort = (bar) => short('JgL5gMtA2X4', bar);

  it('is subscribed when the channel bar lists no subscribe button', () => {
    assert.equal(shortsSubscription(inShort(channelBar({ listsButton: false }))), true);
  });

  it('reads a listed button from its look: filled means not subscribed, tonal means subscribed', () => {
    assert.equal(shortsSubscription(inShort(channelBar({ listsButton: true, buttonClasses: ['ytSpecButtonShapeNextFilled'] }))), false);
    assert.equal(shortsSubscription(inShort(channelBar({ listsButton: true, buttonClasses: ['ytSpecButtonShapeNextTonal'] }))), true);
  });

  it('is unknown when the bar is not loaded or the button look is not recognized', () => {
    assert.equal(shortsSubscription(null), null);
    assert.equal(shortsSubscription(inShort(null)), null);
    assert.equal(shortsSubscription(inShort(element({}))), null);
    assert.equal(shortsSubscription(inShort(channelBar({ listsButton: true, buttonClasses: ['somethingElse'] }))), null);
  });
});
