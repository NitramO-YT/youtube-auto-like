import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickAvatar, ratingAtLoad, readSignedIn, readSnapshot, shortsSubscription } from '../../src/content/youtube/page-data.js';
import { Surface } from '../../src/content/youtube/surface.js';
import { element, fakeDocument } from '../helpers/fake-dom.mjs';

const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const QOQSIK = 'UCfefITu3BR2ix7ZUSrxj16w';

// Shapes observed in Brave on 8 November 2026.
const response = (videoId, overrides = {}) => ({
  videoDetails: { videoId, title: `Title of ${videoId}`, channelId: COLAS, author: 'COLAS', ...overrides.details },
  microformat: { playerMicroformatRenderer: { isShortsEligible: false, ...overrides.microformat } },
});

// Avatar of COLAS, in the sizes and shapes observed on 11 November 2026.
const AVATAR = 'https://yt3.ggpht.com/MVUN-H_w-0QKeMUYdDNiS3NA0cvA8mWGPHNzgTdxvplCbszxBKH-4smhoBfc9GBiI0j8Riu7AA';
const avatarOfSize = (size) => `${AVATAR}=s${size}-c-k-c0x00ffffff-no-rj`;

const owner = (channelId = COLAS) =>
  element({
    props: {
      data: {
        thumbnail: { thumbnails: [48, 88, 176].map((size) => ({ url: avatarOfSize(size), width: size, height: size })) },
        navigationEndpoint: { browseEndpoint: { browseId: channelId, canonicalBaseUrl: '/@COLAS.' } },
      },
    },
  });

// Channels of the collaborations observed on 13 November 2026: u5KEPWtwDiU is
// published by Le BENGE with Kang et ses PC, WT5zWNlEUsk the other way round.
const BENGE = 'UCW-7TvXaVBhtzCivzhTP5zA';
const KANG = 'UC3-dl8nKItitMxM9DNTDAfQ';
// Addresses in the shape of yt3.ggpht.com avatars; not the real pictures.
const collabAvatar = (name) => `https://yt3.ggpht.com/${name}-avatar=s88-c-k-c0x00ffffff-no-rj`;

const collabChannel = (channelId, name) => ({
  listItemViewModel: {
    title: { content: name, commandRuns: [{ onTap: { innertubeCommand: { browseEndpoint: { browseId: channelId } } } }] },
    leadingAccessory: { avatarViewModel: { image: { sources: [{ url: collabAvatar(name), width: 88, height: 88 }] } } },
  },
});

// Owner element of a collaboration as observed: no thumbnail nor
// browseEndpoint, the channels in the dialog of navigationEndpoint, and
// subscriptionButton without subscribed when the user does not subscribe to
// the channel that publishes.
const collabOwner = ({ title, channels, subscriptionButton }) =>
  element({
    props: {
      data: {
        attributedTitle: { content: title },
        ...(subscriptionButton !== undefined && { subscriptionButton }),
        navigationEndpoint: {
          showDialogCommand: {
            panelLoadingStrategy: {
              inlineContent: { dialogViewModel: { customContent: { listViewModel: { listItems: channels } } } },
            },
          },
        },
      },
    },
  });

const bengeWithKang = (options = {}) =>
  collabOwner({
    title: 'Le BENGE et Kang et ses PC',
    channels: [collabChannel(BENGE, 'Le BENGE'), collabChannel(KANG, 'Kang et ses PC')],
    subscriptionButton: { type: 'FREE', subscribed: true },
    ...options,
  });

const decoratedAvatar = (channelId) => ({
  decoratedAvatarViewModel: {
    avatar: { avatarViewModel: { image: { sources: [{ url: avatarOfSize(48) }] } } },
    rendererContext: { commandContext: { onTap: { innertubeCommand: { browseEndpoint: { browseId: channelId } } } } },
  },
});

// Button data as observed: the like command sits in a serialCommand on the
// watch page, directly under onTap in the Shorts player.
const watchToggle = (videoId, isToggled) =>
  element({
    props: {
      data: {
        isToggled,
        defaultButtonViewModel: {
          buttonViewModel: {
            onTap: {
              serialCommand: {
                commands: [{ logGestureCommand: {} }, { innertubeCommand: { likeEndpoint: { target: { videoId } } } }],
              },
            },
          },
        },
      },
    },
  });

const shortsToggle = (videoId, isToggled) =>
  element({
    props: {
      data: {
        isToggled,
        defaultButtonViewModel: { buttonViewModel: { onTap: { innertubeCommand: { likeEndpoint: { target: { videoId } } } } } },
      },
    },
  });

const LIKE_TOGGLE = 'like-button-view-model toggle-button-view-model';
const DISLIKE_TOGGLE = 'dislike-button-view-model toggle-button-view-model';

const watchPage = ({
  playerResponse = response('aeP4eG-gO10'),
  surfaceVideoId = 'aeP4eG-gO10',
  subscribed = true,
  liked = true,
  ownerElement = owner(),
} = {}) =>
  fakeDocument({
    'ytd-watch-flexy ytd-player': element({ props: { getPlayer: () => ({ getPlayerResponse: () => playerResponse }) } }),
    'ytd-watch-flexy': element({ attributes: surfaceVideoId === null ? {} : { 'video-id': surfaceVideoId } }),
    'ytd-watch-metadata ytd-subscribe-button-renderer': element({
      // null: the button without subscribed, as on a collaboration.
      props: { data: subscribed === null ? {} : { subscribed } },
    }),
    ...(ownerElement && { 'ytd-watch-metadata ytd-video-owner-renderer': ownerElement }),
    'ytd-menu-renderer.ytd-watch-metadata segmented-like-dislike-button-view-model': element({
      children: {
        [LIKE_TOGGLE]: watchToggle('aeP4eG-gO10', liked),
        [DISLIKE_TOGGLE]: watchToggle('aeP4eG-gO10', false),
      },
    }),
  });

const channelBar = ({ listsButton, buttonClasses = [], avatarChannel = listsButton ? QOQSIK : COLAS }) =>
  element({
    props: {
      data: {
        ...(listsButton ? { channelName: 'qoqsik', subscribeButtonViewModel: {} } : { channelName: '@COLAS.' }),
        decoratedAvatarViewModel: decoratedAvatar(avatarChannel),
      },
    },
    children: listsButton ? { 'yt-subscribe-button-view-model button': element({ classes: buttonClasses }) } : {},
  });

// Action bar of a Short as observed: data.buttonViewModels lists the like
// button with likeStatus, and no dislike component.
const shortsActionBar = (videoId, { isToggled = false, likeStatus } = {}) =>
  element({
    props: {
      data: {
        buttonViewModels:
          likeStatus === undefined
            ? []
            : [{ likeButtonViewModel: { likeStatusEntityKey: 'key', likeStatusEntity: { likeStatus } } }, { buttonViewModel: {} }],
      },
    },
    children: { [LIKE_TOGGLE]: shortsToggle(videoId, isToggled) },
  });

const short = (videoId, bar, actionBar = shortsActionBar(videoId)) =>
  element({
    props: { data: { command: { reelWatchEndpoint: { videoId } } } },
    children: {
      ...(bar && { 'yt-reel-channel-bar-view-model': bar }),
      'reel-action-bar-view-model': actionBar,
    },
  });

const shortsPage = ({
  videoId = 'JgL5gMtA2X4',
  shortVideoId = videoId,
  bar = channelBar({ listsButton: false }),
  actionBar = shortsActionBar(shortVideoId),
} = {}) =>
  fakeDocument({
    '#shorts-player': element({
      props: { getPlayerResponse: () => response(videoId, { microformat: { isShortsEligible: true } }) },
      ancestors: { 'ytd-reel-video-renderer': short(shortVideoId, bar, actionBar) },
    }),
  });

describe('readSnapshot on the watch page', () => {
  it('reads a regular video of a subscribed channel, liked at load', () => {
    assert.deepEqual(readSnapshot(watchPage(), Surface.WATCH), {
      videoId: 'aeP4eG-gO10',
      surfaceVideoId: 'aeP4eG-gO10',
      title: 'Title of aeP4eG-gO10',
      channelId: COLAS,
      channelName: 'COLAS',
      avatarUrl: avatarOfSize(88),
      signedIn: null,
      isShort: false,
      isLive: false,
      subscribed: true,
      guests: [],
      channelsTitle: '',
      likeAtLoad: { toggled: true, videoId: 'aeP4eG-gO10' },
      dislikeAtLoad: { toggled: false, videoId: 'aeP4eG-gO10' },
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
      likeAtLoad: null,
      dislikeAtLoad: null,
    });
  });

  it('gives the avatar only when the owner element names the channel of the video', () => {
    // The owner element is reused from one video to the next, and can still
    // show the previous channel.
    assert.equal(readSnapshot(watchPage({ ownerElement: owner(QOQSIK) }), Surface.WATCH).avatarUrl, null);
    assert.equal(readSnapshot(watchPage({ ownerElement: owner(null) }), Surface.WATCH).avatarUrl, null);
    assert.equal(readSnapshot(watchPage({ ownerElement: null }), Surface.WATCH).avatarUrl, null);
    const withoutChannel = response('aeP4eG-gO10', { details: { channelId: undefined } });
    assert.equal(readSnapshot(watchPage({ playerResponse: withoutChannel }), Surface.WATCH).avatarUrl, null);
    // Neither the player nor the owner element names a channel.
    assert.equal(readSnapshot(watchPage({ playerResponse: withoutChannel, ownerElement: owner(null) }), Surface.WATCH).avatarUrl, null);
  });

  it('survives a player that throws while being rebuilt', () => {
    const doc = fakeDocument({
      'ytd-watch-flexy ytd-player': element({ props: { getPlayer: () => { throw new Error('player gone'); } } }),
    });
    assert.equal(readSnapshot(doc, Surface.WATCH).videoId, null);
  });
});

describe('readSnapshot on a collaboration', () => {
  const collab = (publisher, ownerElement) =>
    readSnapshot(
      watchPage({
        playerResponse: response('u5KEPWtwDiU', { details: { channelId: publisher, author: 'Le BENGE' } }),
        surfaceVideoId: 'u5KEPWtwDiU',
        subscribed: null,
        ownerElement,
      }),
      Surface.WATCH,
    );

  it('reads the subscription to the channel that publishes, its avatar, the guests and the title', () => {
    const snapshot = collab(BENGE, bengeWithKang());
    assert.equal(snapshot.subscribed, true);
    assert.equal(snapshot.avatarUrl, collabAvatar('Le BENGE'));
    assert.deepEqual(snapshot.guests, [{ id: KANG, name: 'Kang et ses PC', avatarUrl: collabAvatar('Kang et ses PC') }]);
    assert.equal(snapshot.channelsTitle, 'Le BENGE et Kang et ses PC');
  });

  it('reads a subscriptionButton without subscribed as not subscribed, as observed on WT5zWNlEUsk', () => {
    assert.equal(collab(BENGE, bengeWithKang({ subscriptionButton: { type: 'FREE' } })).subscribed, false);
  });

  it('leaves the subscription unknown without subscriptionButton', () => {
    assert.equal(collab(BENGE, bengeWithKang({ subscriptionButton: undefined })).subscribed, null);
    assert.equal(collab(BENGE, bengeWithKang({ subscriptionButton: 'yes' })).subscribed, null);
  });

  it('takes the guests as the channels other than the one that publishes, whatever their order', () => {
    // WT5zWNlEUsk: published by Kang et ses PC, listed second.
    const snapshot = collab(KANG, bengeWithKang());
    assert.deepEqual(snapshot.guests.map((guest) => guest.id), [BENGE]);
    assert.equal(snapshot.avatarUrl, collabAvatar('Kang et ses PC'));
  });

  it('ignores a collaboration that does not list the channel of the player, left by the previous video', () => {
    assert.deepEqual(
      (({ subscribed, avatarUrl, guests, channelsTitle }) => ({ subscribed, avatarUrl, guests, channelsTitle }))(
        collab(COLAS, bengeWithKang()),
      ),
      { subscribed: null, avatarUrl: null, guests: [], channelsTitle: '' },
    );
  });

  it('skips the listed channels without an ID, and reads an empty list as a video of one channel', () => {
    const withBroken = bengeWithKang({ channels: [collabChannel(BENGE, 'Le BENGE'), { listItemViewModel: {} }, null] });
    assert.deepEqual(collab(BENGE, withBroken).guests, []);
    assert.equal(collab(BENGE, withBroken).subscribed, true);
    // An empty list: no collaboration, so the subscription comes from the
    // subscribe button.
    const emptyList = readSnapshot(
      watchPage({ subscribed: false, ownerElement: bengeWithKang({ channels: [], subscriptionButton: { type: 'FREE', subscribed: true } }) }),
      Surface.WATCH,
    );
    assert.equal(emptyList.subscribed, false);
  });
});

describe('readSnapshot in the Shorts player', () => {
  it('reads the Short that holds the player, from the Shorts player', () => {
    assert.deepEqual(readSnapshot(shortsPage(), Surface.SHORTS), {
      videoId: 'JgL5gMtA2X4',
      surfaceVideoId: 'JgL5gMtA2X4',
      title: 'Title of JgL5gMtA2X4',
      channelId: COLAS,
      channelName: 'COLAS',
      avatarUrl: avatarOfSize(48),
      signedIn: null,
      isShort: true,
      isLive: false,
      subscribed: true,
      guests: [],
      channelsTitle: '',
      likeAtLoad: { toggled: false, videoId: 'JgL5gMtA2X4' },
      dislikeAtLoad: null,
    });
  });

  it('reports the Short shown separately from the player, so that a mismatch is visible', () => {
    const snapshot = readSnapshot(shortsPage({ shortVideoId: 'trLwaRWXeJY' }), Surface.SHORTS);
    assert.equal(snapshot.videoId, 'JgL5gMtA2X4');
    assert.equal(snapshot.surfaceVideoId, 'trLwaRWXeJY');
  });

  describe('rating at load from likeStatus', () => {
    const ratings = (options) => {
      const { likeAtLoad, dislikeAtLoad } = readSnapshot(
        shortsPage({ actionBar: shortsActionBar('JgL5gMtA2X4', options) }),
        Surface.SHORTS,
      );
      return { liked: likeAtLoad?.toggled, disliked: dislikeAtLoad?.toggled, dislikeVideoId: dislikeAtLoad?.videoId };
    };

    it('INDIFFERENT, observed on a Short not rated: neither liked nor disliked', () => {
      assert.deepEqual(ratings({ likeStatus: 'INDIFFERENT' }), { liked: false, disliked: false, dislikeVideoId: 'JgL5gMtA2X4' });
    });

    it('LIKE, observed on a liked Short: liked, even when the button data says otherwise', () => {
      assert.deepEqual(ratings({ likeStatus: 'LIKE', isToggled: false }), { liked: true, disliked: false, dislikeVideoId: 'JgL5gMtA2X4' });
    });

    it('any other value counts as disliked, so that it never allows a like', () => {
      assert.equal(ratings({ likeStatus: 'DISLIKE' }).disliked, true);
      assert.equal(ratings({ likeStatus: 'SOMETHING_NEW' }).disliked, true);
      assert.equal(ratings({ likeStatus: '' }).disliked, true);
    });

    it('leaves the dislike state unknown without likeStatus', () => {
      assert.equal(ratings({}).disliked, undefined);
    });
  });

  it('gives the avatar of the channel bar only when it names the channel of the Short', () => {
    assert.equal(readSnapshot(shortsPage({ bar: channelBar({ listsButton: false, avatarChannel: QOQSIK }) }), Surface.SHORTS).avatarUrl, null);
    assert.equal(readSnapshot(shortsPage({ bar: null }), Surface.SHORTS).avatarUrl, null);
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

describe('readSignedIn', () => {
  // ytcfg as observed on 12 November 2026: get() gives LOGGED_IN, a boolean.
  const ytcfg = (values) => ({ get: (key) => values[key] });

  it('reads LOGGED_IN, with and without an account, into the snapshot', () => {
    assert.equal(readSnapshot(watchPage(), Surface.WATCH, ytcfg({ LOGGED_IN: true })).signedIn, true);
    assert.equal(readSnapshot(shortsPage(), Surface.SHORTS, ytcfg({ LOGGED_IN: false })).signedIn, false);
  });

  it('gives null when the page does not say, or says something else than a boolean', () => {
    for (const config of [null, undefined, {}, ytcfg({}), ytcfg({ LOGGED_IN: 'false' }), ytcfg({ LOGGED_IN: 0 })]) {
      assert.equal(readSignedIn(config), null);
    }
    assert.equal(readSignedIn({ get: () => { throw new Error('ytcfg not ready'); } }), null);
  });
});

describe('pickAvatar', () => {
  const sized = (...sizes) => sizes.map((size) => ({ url: avatarOfSize(size), width: size, height: size }));

  it('keeps the smallest size at least 88 pixels wide, in any order', () => {
    assert.equal(pickAvatar(sized(48, 88, 176)), avatarOfSize(88));
    assert.equal(pickAvatar(sized(176, 48, 100)), avatarOfSize(100));
  });

  it('keeps the widest when all are smaller, and the last one when none gives its width', () => {
    assert.equal(pickAvatar(sized(32, 48)), avatarOfSize(48));
    assert.equal(pickAvatar(sized(48, 32)), avatarOfSize(48));
    assert.equal(pickAvatar([{ url: avatarOfSize(48) }, { url: avatarOfSize(64) }]), avatarOfSize(64));
  });

  it('gives null without any address', () => {
    for (const value of [undefined, null, [], [{ width: 88 }], [{ url: 42, width: 88 }], {}]) {
      assert.equal(pickAvatar(value), null, JSON.stringify(value));
    }
  });
});

describe('readSnapshot without a video surface', () => {
  it('returns null', () => {
    assert.equal(readSnapshot(watchPage(), null), null);
  });
});

describe('ratingAtLoad', () => {
  it('reads the state at load and the rated video, in both command shapes', () => {
    assert.deepEqual(ratingAtLoad(watchToggle('JgL5gMtA2X4', true)), { toggled: true, videoId: 'JgL5gMtA2X4' });
    assert.deepEqual(ratingAtLoad(shortsToggle('JgL5gMtA2X4', false)), { toggled: false, videoId: 'JgL5gMtA2X4' });
  });

  it('gives null for a missing component and null fields for missing data', () => {
    assert.equal(ratingAtLoad(null), null);
    assert.equal(ratingAtLoad(element({})), null);
    assert.deepEqual(ratingAtLoad(element({ props: { data: { isToggled: 'yes' } } })), { toggled: null, videoId: null });
  });

  it('does not search the like command indefinitely deep', () => {
    let deep = { likeEndpoint: { target: { videoId: 'JgL5gMtA2X4' } } };
    for (let level = 0; level < 20; level++) deep = { next: deep };
    assert.equal(ratingAtLoad(element({ props: { data: { isToggled: false, defaultButtonViewModel: deep } } })).videoId, null);
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
