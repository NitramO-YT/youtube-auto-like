import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Status } from '../../src/content/isolated/session.js';
import { Reason } from '../../src/core/eligibility.js';
import { normalizeSettings } from '../../src/core/settings.js';
import { CHANNEL_CHOICES, ChannelChoice, channelChoice, listForChoice, moveNoticeKey } from '../../src/ui/shared/channel-choice.js';
import { Action, actions, channelPageView, statusCard, videoView } from '../../src/ui/popup/view.js';
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

  it('asks to sign in to YouTube when no account is, active or paused', () => {
    const card = cardOf({ status: Status.NOT_ELIGIBLE, reason: Reason.SIGNED_OUT }, defaults, fr);
    assert.equal(card.title, 'Connectez-vous à YouTube');
    assert.equal(card.detail, "Aucun compte n'est connecté, et YouTube ne permet de liker qu'avec un compte. L'extension reprend dès la connexion.");
    const pausedCard = cardOf({ status: Status.NOT_ELIGIBLE, reason: Reason.DISABLED, ifEnabled: { eligible: false, reason: Reason.SIGNED_OUT } }, paused);
    assert.equal(pausedCard.title, 'Sign in to YouTube');
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

describe('a rating removed, and a video to restart', () => {
  const removed = { liked: false, disliked: false };

  it('shows a like removed, by the extension or by the user, with "restart"', () => {
    for (const state of [{ status: Status.LIKED }, { status: Status.SKIPPED, reason: Reason.ALREADY_LIKED }]) {
      const now = status({ ...state, rating: removed, target: { at: 0, basis: 'instant' } });
      assert.equal(statusCard(now, defaults, en, 'en', NOW).title, 'Like removed');
      assert.deepEqual(actions(now, defaults, NOW), [Action.RESTART]);
    }
    const stillLiked = status({ status: Status.LIKED, rating: { liked: true, disliked: false }, target: { at: 0, basis: 'instant' } });
    assert.equal(statusCard(stillLiked, defaults, en, 'en', NOW).title, 'Liked automatically');
  });

  it('shows a dislike removed with "restart"', () => {
    const now = status({ status: Status.SKIPPED, reason: Reason.ALREADY_DISLIKED, rating: removed });
    assert.equal(statusCard(now, defaults, en, 'en', NOW).title, 'Dislike removed');
    assert.deepEqual(actions(now, defaults, NOW), [Action.RESTART]);
  });

  it('says when a like removed comes back, and offers to like now', () => {
    const atTime = status({ status: Status.NOT_ELIGIBLE, reason: Reason.LIKE_REMOVED, target: { at: 562.5, basis: 'percent' } });
    assert.equal(statusCard(atTime, defaults, fr, 'fr', NOW).detail, 'Il sera remis quand la lecture repassera à 9:22.');
    const instantLike = status({ status: Status.NOT_ELIGIBLE, reason: Reason.LIKE_REMOVED, target: { at: 0, basis: 'instant' } });
    assert.equal(statusCard(instantLike, defaults, fr, 'fr', NOW).detail, 'Il sera remis à la prochaine ouverture de la vidéo.');
    assert.deepEqual(actions(atTime, defaults, NOW), [Action.LIKE_NOW]);
  });

  it('offers to try again after a like that did not take, and to restart a page read for too long', () => {
    assert.deepEqual(actions(status({ status: Status.CLICK_FAILED }), defaults, NOW), [Action.RETRY]);
    const reading = (age) => status({ status: Status.READING, startedAt: NOW - age, channel: null });
    assert.deepEqual(actions(reading(5_000), defaults, NOW), []);
    assert.deepEqual(actions(reading(25_000), defaults, NOW), [Action.RESTART]);
  });
});

describe('channel choice', () => {
  const channel = (subscribed) => ({ id: COLAS, name: 'COLAS', subscribed });
  const listed = (list, settings = {}) => normalizeSettings({ ...settings, lists: { [list]: [{ id: COLAS, name: 'COLAS' }] } });

  it('is the list the channel is in, or "per my settings" in neither, whatever the subscription', () => {
    assert.equal(channelChoice(channel(true), listed('always')), ChannelChoice.ALWAYS);
    assert.equal(channelChoice(channel(false), listed('never', { likeWhat: 'all' })), ChannelChoice.NEVER);
    for (const subscribed of [true, false, null]) assert.equal(channelChoice(channel(subscribed), defaults), ChannelChoice.AUTO);
  });

  it('puts the channel in the list of the choice, or in none for "per my settings"', () => {
    assert.deepEqual(CHANNEL_CHOICES.map(listForChoice), ['always', null, 'never']);
  });

  it('says where the channel went, or which list it left', () => {
    assert.equal(moveNoticeKey('always', 'never'), 'noticeAddedAlways');
    assert.equal(moveNoticeKey('never', null), 'noticeAddedNever');
    assert.equal(moveNoticeKey(null, 'always'), 'noticeRemovedAlways');
    assert.equal(moveNoticeKey(null, 'never'), 'noticeRemovedNever');
  });

  it('shows on a channel page, with the channel', () => {
    const view = channelPageView({ id: COLAS, name: '', avatarUrl: null }, listed('always'), en);
    assert.deepEqual(view, {
      channel: { id: COLAS, name: 'Unknown channel', initial: '?', avatarUrl: null, meta: '' },
      choice: ChannelChoice.ALWAYS,
    });
    assert.equal(channelPageView(null, defaults, en), null);
  });

  it('shows in the view even while the extension is paused, and not without a channel', () => {
    assert.deepEqual(videoView(status(), listed('never', { enabled: false }), en, 'en', NOW).choice, {
      choice: ChannelChoice.NEVER,
      channels: null,
      selected: COLAS,
    });
    assert.equal(videoView(status({ channel: null }), defaults, en, 'en', NOW).choice, null);
  });
});

describe('video made by several channels', () => {
  // u5KEPWtwDiU, 13 November 2026: published by Le BENGE, with Kang et ses PC.
  const BENGE = 'UCW-7TvXaVBhtzCivzhTP5zA';
  const KANG = 'UC3-dl8nKItitMxM9DNTDAfQ';
  const collab = (overrides = {}) =>
    status({
      channel: { id: BENGE, name: 'Le BENGE', avatarUrl: null, subscribed: true },
      guests: [{ id: KANG, name: 'Kang et ses PC', avatarUrl: null }],
      channelsTitle: 'Le BENGE et Kang et ses PC',
      ...overrides,
    });
  const neverKang = normalizeSettings({ lists: { never: [{ id: KANG, name: 'Kang et ses PC' }] } });

  it('shows the name of all its channels, and names the one the subscription is about', () => {
    const view = videoView(collab(), defaults, fr, 'fr', NOW);
    assert.equal(view.channel.name, 'Le BENGE et Kang et ses PC');
    assert.equal(view.channel.initial, 'L');
    assert.equal(view.channel.meta, 'Abonné à Le BENGE · Vidéo de 18:45');
    const notSubscribed = collab({ channel: { id: BENGE, name: 'Le BENGE', avatarUrl: null, subscribed: false } });
    assert.equal(videoView(notSubscribed, defaults, en, 'en', NOW).channel.meta, 'Not subscribed to Le BENGE · 18:45 video');
  });

  it('falls back on the name of the channel that publishes when YouTube gives no title', () => {
    assert.equal(videoView(collab({ channelsTitle: '' }), defaults, en, 'en', NOW).channel.name, 'Le BENGE');
    // A title without guests is not a collaboration.
    assert.equal(videoView(status({ channelsTitle: 'Somebody else' }), defaults, en, 'en', NOW).channel.name, 'COLAS');
  });

  it('names the channel at stake in the reasons not to like', () => {
    const notSubscribed = collab({
      status: Status.NOT_ELIGIBLE,
      reason: Reason.NOT_SUBSCRIBED,
      channel: { id: BENGE, name: 'Le BENGE', avatarUrl: null, subscribed: false },
    });
    assert.equal(
      statusCard(notSubscribed, defaults, en, 'en', NOW).detail,
      'You are not subscribed to Le BENGE, which publishes this video. It will be liked if you subscribe.',
    );
    const guestNever = collab({ status: Status.NOT_ELIGIBLE, reason: Reason.GUEST_IN_NEVER_LIST });
    assert.equal(
      statusCard(guestNever, neverKang, fr, 'fr', NOW).detail,
      'Kang et ses PC, chaîne invitée de cette vidéo, est dans votre liste « Ne jamais liker ».',
    );
    // Paused, the same reason comes from what the extension would do.
    const pausedGuest = collab({ status: Status.READING, ifEnabled: { eligible: false, reason: Reason.GUEST_IN_NEVER_LIST } });
    const pausedNeverKang = normalizeSettings({ ...neverKang, enabled: false });
    assert.match(statusCard(pausedGuest, pausedNeverKang, en, 'en', NOW).detail, /^Kang et ses PC, a guest channel/);
  });

  it('keeps the usual words for a video of one channel', () => {
    const one = status({ status: Status.NOT_ELIGIBLE, reason: Reason.NOT_SUBSCRIBED, channel: { id: COLAS, name: 'COLAS', subscribed: false } });
    assert.equal(statusCard(one, defaults, en, 'en', NOW).detail, en('reasonNotSubscribed'));
  });

  it('lists its channels for the choice, the one that publishes first and selected by default', () => {
    const { choice } = videoView(collab(), neverKang, en, 'en', NOW);
    assert.deepEqual(choice, {
      choice: ChannelChoice.AUTO,
      channels: [
        { id: BENGE, name: 'Le BENGE' },
        { id: KANG, name: 'Kang et ses PC' },
      ],
      selected: BENGE,
    });
  });

  it('gives the choice of the guest the user picked, and ignores a channel the video does not list', () => {
    assert.deepEqual(
      (({ choice, selected }) => ({ choice, selected }))(videoView(collab(), neverKang, en, 'en', NOW, KANG).choice),
      { choice: ChannelChoice.NEVER, selected: KANG },
    );
    assert.equal(videoView(collab(), neverKang, en, 'en', NOW, COLAS).choice.selected, BENGE);
    // On a video of one channel, a channel picked earlier does not count.
    assert.equal(videoView(status(), neverKang, en, 'en', NOW, KANG).choice.selected, COLAS);
  });
});

describe('statusCard: reading the page', () => {
  it('gives the hint about the buttons of a Short only on a Short', () => {
    const reading = (isShort) => cardOf({ status: Status.READING, isShort, channel: null });
    assert.equal(reading(true).detail, en('statusReadingDetail'));
    assert.equal(reading(false).detail, null);
    assert.equal(reading(null).detail, null);
    assert.equal(reading(false).title, 'Reading the page…');
  });
});

describe('actions', () => {
  it('offers "like now", "not this time" and "never this video" only while the video waits', () => {
    const waiting = [Action.LIKE_NOW, Action.SKIP, Action.EXCLUDE_VIDEO];
    assert.deepEqual(actions(status({ status: Status.WAITING }), defaults), waiting);
    assert.deepEqual(actions(status({ status: Status.WAITING_AD }), defaults), waiting);
    assert.deepEqual(actions(status({ status: Status.LIKED }), defaults), []);
    assert.deepEqual(actions(status({ status: Status.CONFIRMING }), defaults), []);
  });

  it('offers to take back "not this time", to like now or to exclude for good, and to stop excluding an excluded video', () => {
    const skipped = status({ status: Status.SKIPPED, reason: Reason.SKIPPED_BY_USER });
    assert.deepEqual(actions(skipped, defaults), [Action.RESUME, Action.LIKE_NOW, Action.EXCLUDE_VIDEO]);
    const excluded = status({ status: Status.NOT_ELIGIBLE, reason: Reason.VIDEO_EXCLUDED });
    assert.deepEqual(actions(excluded, defaults), [Action.UNEXCLUDE_VIDEO]);
    assert.deepEqual(actions(status({ status: Status.SKIPPED, reason: Reason.ALREADY_LIKED }), defaults), []);
  });

  it('offers nothing while the extension is paused', () => {
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
