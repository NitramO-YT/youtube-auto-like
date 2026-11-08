import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Status } from '../../src/content/isolated/session.js';
import { Reason } from '../../src/core/eligibility.js';
import { normalizeSettings } from '../../src/core/settings.js';
import { Action, actions, channelAction, statusCard, videoView } from '../../src/ui/popup/view.js';
import { translator } from '../helpers/fake-i18n.mjs';

const en = translator('en');
const fr = translator('fr');
const NOW = 1_000_000;
const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';

const defaults = normalizeSettings({});
const paused = normalizeSettings({ enabled: false });
const halfway = normalizeSettings({ timing: { mode: 'custom', percent: { enabled: true, value: 50 }, minutes: { enabled: false, value: 2 } } });

const status = (overrides = {}) => ({
  videoId: 'aeP4eG-gO10',
  isShort: false,
  isLive: false,
  channel: { id: COLAS, name: 'COLAS', avatarUrl: null, subscribed: true },
  status: Status.WAITING,
  reason: null,
  target: null,
  elapsed: 120,
  duration: 1125,
  likedAt: null,
  ifEnabled: null,
  ...overrides,
});

const cardOf = (overrides, settings = defaults, t = en) => statusCard(status(overrides), settings, t, t === fr ? 'fr' : 'en', NOW);

describe('statusCard: liked', () => {
  it('says when and how the video was liked', () => {
    const liked = { status: Status.LIKED, likedAt: NOW - 12_000 };
    assert.deepEqual(cardOf({ ...liked, target: { at: 0, basis: 'instant' } }), {
      tone: 'liked',
      icon: 'check',
      title: 'Liked automatically',
      detail: '12 seconds ago, as soon as it opened',
      progress: null,
    });
    assert.equal(cardOf({ ...liked, target: { at: 0, basis: 'like-now' } }).detail, '12 seconds ago, at your request');
    assert.equal(cardOf({ ...liked, target: { at: 562.5, basis: 'percent' } }).detail, '12 seconds ago, at 9:22 into the video');
    assert.equal(
      cardOf({ ...liked, isLive: true, target: { at: 120, basis: 'minutes' } }).detail,
      '12 seconds ago, after 2 min 0 s of watching',
    );
  });

  it('stays shown as liked while the extension is paused', () => {
    assert.equal(cardOf({ status: Status.LIKED, likedAt: NOW, target: { at: 0, basis: 'instant' } }, paused).title, 'Liked automatically');
  });
});

describe('statusCard: waiting', () => {
  it('shows the like time, what is left, and the progress', () => {
    const card = cardOf({ target: { at: 562.5, basis: 'percent' }, elapsed: 214.5 }, halfway, fr);
    assert.equal(card.title, 'Sera likée à 50 % de la vidéo');
    assert.equal(card.detail, 'encore 5 min 48 de lecture');
    assert.equal(card.tone, 'wait');
    assert.ok(Math.abs(card.progress - 214.5 / 562.5) < 1e-9);
  });

  it('names each kind of like time', () => {
    const title = (basis) => cardOf({ target: { at: 600, basis } }, halfway).title;
    assert.equal(title('minutes'), 'Will be liked after 2 min of playback');
    assert.equal(title('random'), 'Will be liked at a random moment');
    assert.equal(title('before-end'), 'Will be liked just before the end');
  });

  it('says "in a moment" once the like time is reached, and for an instant like', () => {
    assert.equal(cardOf({ target: { at: 100, basis: 'percent' }, elapsed: 120 }, halfway).title, 'Liking in a moment');
    assert.equal(cardOf({ target: { at: 0, basis: 'instant' } }).title, 'Liking in a moment');
  });

  it('waits for the duration, an ad, the page or the confirmation', () => {
    assert.equal(cardOf({ target: null }).title, 'Waiting for the length of the video');
    assert.equal(cardOf({ status: Status.WAITING_AD }).title, 'Waiting for the ad to end');
    assert.equal(cardOf({ status: Status.READING }).title, 'Reading the page…');
    assert.equal(cardOf({ status: Status.CONFIRMING }).title, 'Checking that the like went through…');
  });
});

describe('statusCard: not liked', () => {
  it('gives the reason in words, for every reason the liker can give', () => {
    for (const reason of [
      Reason.ALREADY_DISLIKED,
      Reason.NOT_SUBSCRIBED,
      Reason.NOT_IN_ALWAYS_LIST,
      Reason.IN_NEVER_LIST,
      Reason.SHORTS_OFF,
      Reason.NORMAL_VIDEOS_OFF,
      Reason.VIDEO_EXCLUDED,
    ]) {
      const card = cardOf({ status: Status.NOT_ELIGIBLE, reason });
      assert.equal(card.title, 'Not liked', reason);
      assert.ok(card.detail, reason);
    }
    assert.equal(
      cardOf({ status: Status.NOT_ELIGIBLE, reason: Reason.NOT_SUBSCRIBED }, defaults, fr).detail,
      "Vous n'êtes pas abonné à cette chaîne. Elle sera likée si vous vous abonnez.",
    );
  });

  it('tells a video the user rated or skipped', () => {
    const liked = cardOf({ status: Status.SKIPPED, reason: Reason.ALREADY_LIKED });
    assert.equal(liked.title, 'Already liked');
    assert.equal(liked.tone, 'liked');
    assert.equal(
      cardOf({ status: Status.SKIPPED, reason: Reason.SKIPPED_BY_USER }).detail,
      'You asked not to like it this time. It may be liked when you watch it again.',
    );
  });

  it('reports a click that did not take', () => {
    const card = cardOf({ status: Status.CLICK_FAILED });
    assert.equal(card.tone, 'error');
    assert.equal(card.title, 'The like could not be confirmed');
  });
});

describe('statusCard: paused', () => {
  it('says what the extension would do if it were active', () => {
    const waiting = { status: Status.NOT_ELIGIBLE, reason: Reason.DISABLED };
    assert.equal(cardOf({ ...waiting, ifEnabled: { eligible: true, reason: Reason.ELIGIBLE } }, paused).title, 'Would be liked');
    const notSubscribed = cardOf({ ...waiting, ifEnabled: { eligible: false, reason: Reason.NOT_SUBSCRIBED } }, paused);
    assert.equal(notSubscribed.title, 'Not liked');
    assert.equal(cardOf({ ...waiting, ifEnabled: null }, paused).title, 'Reading the page…');
    assert.equal(cardOf({ ...waiting, ifEnabled: { eligible: false, reason: Reason.UNKNOWN_STATE } }, paused).title, 'Reading the page…');
  });
});

describe('channelAction', () => {
  const channel = (subscribed) => ({ id: COLAS, name: 'COLAS', subscribed });
  const listed = (list, settings = {}) => normalizeSettings({ ...settings, lists: { [list]: [{ id: COLAS, name: 'COLAS' }] } });

  it('offers "never" for a channel that is liked, "always" for one that is not', () => {
    assert.equal(channelAction(channel(true), defaults), Action.NEVER);
    assert.equal(channelAction(channel(false), defaults), Action.ALWAYS);
    assert.equal(channelAction(channel(false), normalizeSettings({ likeWhat: 'all' })), Action.NEVER);
    assert.equal(channelAction(channel(true), normalizeSettings({ likeWhat: 'alwaysList' })), Action.ALWAYS);
    assert.equal(channelAction(channel(false), listed('always')), Action.NEVER);
  });

  it('offers to take a channel out of "never like", whatever else applies', () => {
    assert.equal(channelAction(channel(true), listed('never')), Action.UNLIST_NEVER);
    assert.equal(channelAction(channel(true), listed('never', { likeWhat: 'all' })), Action.UNLIST_NEVER);
  });
});

describe('actions', () => {
  it('offers "like now", "not this time" and "never this video" only while the video waits', () => {
    const waiting = [Action.LIKE_NOW, Action.SKIP, Action.EXCLUDE_VIDEO, Action.NEVER];
    assert.deepEqual(actions(status({ status: Status.WAITING }), defaults), waiting);
    assert.deepEqual(actions(status({ status: Status.WAITING_AD }), defaults), waiting);
    assert.deepEqual(actions(status({ status: Status.LIKED }), defaults), [Action.NEVER]);
    assert.deepEqual(actions(status({ status: Status.CONFIRMING }), defaults), [Action.NEVER]);
  });

  it('offers to take back "not this time", to like now or to exclude for good, and to stop excluding an excluded video', () => {
    const skipped = status({ status: Status.SKIPPED, reason: Reason.SKIPPED_BY_USER });
    assert.deepEqual(actions(skipped, defaults), [Action.RESUME, Action.LIKE_NOW, Action.EXCLUDE_VIDEO, Action.NEVER]);
    const excluded = status({ status: Status.NOT_ELIGIBLE, reason: Reason.VIDEO_EXCLUDED });
    assert.deepEqual(actions(excluded, defaults), [Action.UNEXCLUDE_VIDEO, Action.NEVER]);
    assert.deepEqual(actions(status({ status: Status.SKIPPED, reason: Reason.ALREADY_LIKED }), defaults), [Action.NEVER]);
  });

  it('offers nothing while the extension is paused, and no list without a channel', () => {
    assert.deepEqual(actions(status(), paused), []);
    assert.deepEqual(actions(status({ status: Status.READING, channel: null }), defaults), []);
  });
});

describe('videoView', () => {
  it('describes the channel of the video', () => {
    const view = videoView(status(), defaults, fr, 'fr', NOW);
    assert.deepEqual(view.channel, { id: COLAS, name: 'COLAS', initial: 'C', avatarUrl: null, meta: 'Abonné · Vidéo de 18:45' });
    const short = videoView(status({ isShort: true, channel: { id: COLAS, name: '', subscribed: false } }), defaults, en, 'en', NOW);
    assert.deepEqual([short.channel.name, short.channel.initial, short.channel.meta], ['Unknown channel', '?', 'Not subscribed · Short']);
    assert.equal(videoView(status({ isLive: true }), defaults, en, 'en', NOW).channel.meta, 'Subscribed · Live');
  });

  it('gives the title of the video, or none when the page has not given it', () => {
    assert.equal(videoView(status({ title: 'le moooonstre' }), defaults, en, 'en', NOW).title, 'le moooonstre');
    assert.equal(videoView(status({ title: '' }), defaults, en, 'en', NOW).title, null);
  });

  it('gives nothing when the tab shows no video', () => {
    assert.equal(videoView({ videoId: null }, defaults, en, 'en', NOW), null);
    assert.equal(videoView(null, defaults, en, 'en', NOW), null);
  });
});
