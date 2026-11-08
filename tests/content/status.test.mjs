import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSession, Status } from '../../src/content/isolated/session.js';
import { popupStatus } from '../../src/content/isolated/status.js';
import { normalizeSettings } from '../../src/core/settings.js';

const VIDEO_ID = 'aeP4eG-gO10';
const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const AVATAR = 'https://yt3.ggpht.com/avatar';

const observation = (overrides = {}) => ({
  snapshot: {
    videoId: VIDEO_ID,
    surfaceVideoId: VIDEO_ID,
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
    const settings = normalizeSettings({ lists: { always: [{ id: COLAS, name: 'COLAS' }] } });
    assert.deepEqual(popupStatus(session, observation(), settings), {
      videoId: VIDEO_ID,
      isShort: false,
      isLive: false,
      channel: { id: COLAS, name: 'COLAS', avatarUrl: AVATAR, subscribed: true, list: 'always' },
      status: Status.WAITING,
      reason: null,
      target: { at: 562.5, basis: 'percent' },
      elapsed: 120.5,
      duration: 1125,
      likedAt: null,
    });
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
