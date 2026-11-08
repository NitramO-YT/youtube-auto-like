import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSession, Status } from '../../src/content/isolated/session.js';
import { popupStatus } from '../../src/content/isolated/status.js';
import { Reason } from '../../src/core/eligibility.js';
import { normalizeSettings } from '../../src/core/settings.js';

const VIDEO_ID = 'aeP4eG-gO10';
const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const AVATAR = 'https://yt3.ggpht.com/avatar';

const observation = (overrides = {}) => ({
  snapshot: {
    videoId: VIDEO_ID,
    surfaceVideoId: VIDEO_ID,
    title: "J'AI CONSTRUIT MON ATELIER DE RÊVE !",
    channelId: COLAS,
    channelName: 'COLAS',
    isShort: false,
    isLive: false,
    subscribed: true,
    likeAtLoad: null,
    dislikeAtLoad: null,
  },
  avatarUrl: AVATAR,
  position: 120.5,
  duration: 1125,
  ...overrides,
});

describe('popupStatus', () => {
  it('describes the video, its channel and the decision', () => {
    const session = { ...createSession(VIDEO_ID, 0, 0.5), status: Status.WAITING, target: { at: 562.5, basis: 'percent' } };
    assert.deepEqual(popupStatus(session, observation(), normalizeSettings({})), {
      videoId: VIDEO_ID,
      title: "J'AI CONSTRUIT MON ATELIER DE RÊVE !",
      isShort: false,
      isLive: false,
      channel: { id: COLAS, name: 'COLAS', avatarUrl: AVATAR, subscribed: true },
      status: Status.WAITING,
      reason: null,
      target: { at: 562.5, basis: 'percent' },
      elapsed: 120.5,
      duration: 1125,
      likedAt: null,
      startedAt: 0,
      rating: { liked: null, disliked: null },
      ifEnabled: null,
    });
  });

  it('tells, while the extension is paused, what it would do if it were active', () => {
    const session = createSession(VIDEO_ID, 0, 0.5);
    const paused = normalizeSettings({ enabled: false });
    const unrated = observation({ liked: false, disliked: false });
    const notRated = { toggled: false, videoId: VIDEO_ID };
    unrated.snapshot = { ...unrated.snapshot, likeAtLoad: notRated, dislikeAtLoad: notRated };
    assert.deepEqual(popupStatus(session, unrated, paused).ifEnabled, { eligible: true, reason: Reason.ELIGIBLE });
    const liked = observation({ liked: true, disliked: false });
    assert.deepEqual(popupStatus(session, liked, paused).ifEnabled, { eligible: false, reason: Reason.ALREADY_LIKED });
    assert.equal(popupStatus(session, null, paused).ifEnabled, null);
  });

  it('gives no channel before the page is read, or when it shows another video', () => {
    const session = createSession(VIDEO_ID, 0, 0.5);
    assert.equal(popupStatus(session, null, normalizeSettings({})).channel, null);
    const other = observation();
    other.snapshot = { ...other.snapshot, videoId: 'aaaaaaaaaaa' };
    assert.equal(popupStatus(session, other, normalizeSettings({})).channel, null);
  });

  it('counts the time watched on a live stream, and ignores an unknown duration', () => {
    const session = { ...createSession(VIDEO_ID, 0, 0.5), liveStart: 5000 };
    const live = observation({ position: 5090, duration: Number.POSITIVE_INFINITY });
    live.snapshot = { ...live.snapshot, isLive: true };
    const status = popupStatus(session, live, normalizeSettings({}));
    assert.equal(status.elapsed, 90);
    assert.equal(status.duration, null);
  });
});
