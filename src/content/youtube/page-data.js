/**
 * Data that only YouTube's own objects hold, read from the MAIN world.
 * Paths checked in Brave on 8 November 2026; when YouTube changes, this file
 * is where the reading breaks.
 *
 * Watch page:
 * - ytd-watch-flexy ytd-player .getPlayer().getPlayerResponse(): videoDetails
 *   (videoId, title, channelId, author, isLive) and microformat
 *   .playerMicroformatRenderer.isShortsEligible, which stays true for a Short
 *   opened in the watch page by a redirecting extension.
 * - ytd-watch-flexy, attribute video-id: the video its buttons belong to.
 * - ytd-watch-metadata ytd-subscribe-button-renderer .data.subscribed.
 *
 * Shorts player:
 * - #shorts-player .getPlayerResponse(): same fields as on the watch page.
 * - The Short shown is the ytd-reel-video-renderer that contains
 *   #shorts-player; its .data.command.reelWatchEndpoint.videoId is the Short's
 *   ID, and its yt-reel-channel-bar-view-model holds the subscription (see
 *   shortsSubscription).
 *
 * Rating at page load, on both surfaces: the toggle-button-view-model of the
 * like and dislike buttons holds .data.isToggled, the state YouTube sent with
 * the page, and the ID of the video its button rates
 * (likeEndpoint.target.videoId, inside the commands of the button). The
 * liker has read aria-pressed="false" on a video liked at page load (a Short
 * opened in the watch page, Brave, 8 November 2026): the button alone cannot
 * prove that a video is not liked yet.
 *
 * In the Shorts player, the action bar's own data also holds the rating sent
 * with the page, likeButtonViewModel.likeStatusEntity.likeStatus: "LIKE" and
 * "INDIFFERENT" observed on 8 November 2026. The Shorts player often shows
 * no dislike button at all (neither YouTube's nor Return YouTube Dislike's),
 * so this is where the dislike state at load comes from there. Any value
 * other than the two observed counts as disliked, so that an unknown value
 * never allows a like.
 *
 * Channel avatar, checked in Brave on 11 November 2026, read from data
 * rather than from the img shown, which can be empty when the like is made
 * (the page has not loaded the picture yet, or does not show it, as in full
 * screen):
 * - watch page: ytd-watch-metadata ytd-video-owner-renderer .data, with
 *   thumbnail.thumbnails (48, 88 and 176 pixels) and the channel in
 *   navigationEndpoint.browseEndpoint.browseId;
 * - Shorts player: the yt-reel-channel-bar-view-model of the Short shown,
 *   .data.decoratedAvatarViewModel.decoratedAvatarViewModel, with
 *   avatar.avatarViewModel.image.sources (one source, 48 pixels, without
 *   width) and the channel in rendererContext.commandContext.onTap
 *   .innertubeCommand.browseEndpoint.browseId.
 * The owner element of the watch page is reused from one video to the next:
 * an avatar counts only when its channel is the one of the player response.
 *
 * Video made by several channels (a collaboration), checked in Brave on
 * 13 November 2026 (.claude/docs/donnees-youtube.md): the owner element's
 * data has no thumbnail nor browseEndpoint, but attributedTitle.content
 * ("Le BENGE et Kang et ses PC"), subscriptionButton, and in
 * navigationEndpoint.showDialogCommand the list of the channels
 * (listViewModel.listItems[].listItemViewModel: title.content, the channel
 * in title.commandRuns[0].onTap.innertubeCommand.browseEndpoint.browseId,
 * the avatar in leadingAccessory.avatarViewModel.image.sources). The
 * ytd-subscribe-button-renderer has no subscribed there.
 * subscriptionButton.subscribed tells the subscription to the channel that
 * publishes the video only (the one of the player response), and is left
 * out when false. Whether the user subscribes to the other channels is not
 * in the data.
 *
 * Session: window.ytcfg.get('LOGGED_IN'), true with an account signed in
 * (Brave) and false without (blank Firefox profile), a boolean in both
 * cases, checked on 12 November 2026. Without an account, the like button
 * is there but only offers to sign in.
 *
 * Every access is guarded: a missing piece gives null, never an exception.
 */
import { Surface } from './surface.js';

const WATCH_PAGE = 'ytd-watch-flexy';
const WATCH_PLAYER = 'ytd-watch-flexy ytd-player';
const WATCH_SUBSCRIBE = 'ytd-watch-metadata ytd-subscribe-button-renderer';
const WATCH_OWNER = 'ytd-watch-metadata ytd-video-owner-renderer';
// Width of the avatar kept when the page offers several: the popup and the
// options page show it at 26 to 32 CSS pixels (theme.css, options.css),
// sharp up to a screen of twice the density.
const AVATAR_WIDTH = 88;
const WATCH_RATING_BAR = 'ytd-menu-renderer.ytd-watch-metadata segmented-like-dislike-button-view-model';
const SHORTS_PLAYER = '#shorts-player';
const SHORT = 'ytd-reel-video-renderer';
const SHORTS_RATING_BAR = 'reel-action-bar-view-model';
const LIKE_TOGGLE = 'like-button-view-model toggle-button-view-model';
const DISLIKE_TOGGLE = 'dislike-button-view-model toggle-button-view-model';
const SHORTS_CHANNEL_BAR = 'yt-reel-channel-bar-view-model';
const NOT_DISLIKED_STATUSES = ['LIKE', 'INDIFFERENT'];
// Depth of the like command below defaultButtonViewModel: 6 levels on the
// watch page, 3 in the Shorts player (checked on 8 November 2026), with some
// margin.
const MAX_COMMAND_DEPTH = 10;
const SHORTS_SUBSCRIBE_BUTTON = 'yt-subscribe-button-view-model button';
// Look of the subscribe button: filled while not subscribed, tonal once
// subscribed (classes from Taknok/youtube-auto-like; the tonal one is not yet
// observed in this project).
const NOT_SUBSCRIBED_CLASS = 'ytSpecButtonShapeNextFilled';
const SUBSCRIBED_CLASS = 'ytSpecButtonShapeNextTonal';

function guarded(read) {
  try {
    return read() ?? null;
  } catch {
    // A player being torn down or rebuilt can throw; the next read sees the
    // new one.
    return null;
  }
}

/**
 * In the Shorts player, the channel bar lists a subscribe button only for a
 * channel the user is not subscribed to. Its data holds both versions of the
 * button ("Subscribe" and "Subscribed"), not the current state, so a listed
 * button is read from its look on the page.
 */
export function shortsSubscription(short) {
  const bar = short?.querySelector(SHORTS_CHANNEL_BAR);
  if (!bar?.data) return null;
  if (!bar.data.subscribeButtonViewModel) return true;
  const button = bar.querySelector(SHORTS_SUBSCRIBE_BUTTON);
  if (button?.classList.contains(SUBSCRIBED_CLASS)) return true;
  if (button?.classList.contains(NOT_SUBSCRIBED_CLASS)) return false;
  return null;
}

/**
 * The address of the image to keep among the sizes of an avatar: the
 * smallest at least AVATAR_WIDTH wide, else the widest; the last one when
 * none gives its width. null without any address.
 */
export function pickAvatar(thumbnails) {
  if (!Array.isArray(thumbnails)) return null;
  const usable = thumbnails.filter((thumbnail) => typeof thumbnail?.url === 'string');
  const sized = usable.filter((thumbnail) => Number.isFinite(thumbnail.width)).sort((a, b) => a.width - b.width);
  const chosen = sized.find((thumbnail) => thumbnail.width >= AVATAR_WIDTH) ?? sized.at(-1) ?? usable.at(-1);
  return chosen?.url ?? null;
}

const avatarOf = (channelId, url) => (typeof channelId === 'string' && url ? { channelId, url } : null);

/** { channelId, url } of the avatar in the data of the owner element of the watch page, or null. */
export function watchOwnerAvatar(owner) {
  const data = owner?.data;
  return avatarOf(data?.navigationEndpoint?.browseEndpoint?.browseId, pickAvatar(data?.thumbnail?.thumbnails));
}

/**
 * The channels of a collaboration, from the data of the owner element of
 * the watch page: { title, subscribed, channels: [{ id, name, avatarUrl }] },
 * unchecked; null for a video of one channel.
 */
export function watchCollaboration(owner) {
  const data = owner?.data;
  const items = data?.navigationEndpoint?.showDialogCommand?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.customContent?.listViewModel?.listItems;
  if (!Array.isArray(items) || items.length === 0) return null;
  const channels = items
    .map((item) => {
      const model = item?.listItemViewModel;
      return {
        id: model?.title?.commandRuns?.[0]?.onTap?.innertubeCommand?.browseEndpoint?.browseId,
        name: model?.title?.content,
        avatarUrl: pickAvatar(model?.leadingAccessory?.avatarViewModel?.image?.sources),
      };
    })
    .filter((channel) => typeof channel.id === 'string');
  const button = data.subscriptionButton;
  return {
    title: data.attributedTitle?.content,
    // YouTube leaves subscribed out when it is false.
    subscribed: button && typeof button === 'object' ? button.subscribed === true : null,
    channels,
  };
}

/** { channelId, url } of the avatar in the data of the channel bar of a Short, or null. */
export function shortsBarAvatar(short) {
  const model = short?.querySelector(SHORTS_CHANNEL_BAR)?.data?.decoratedAvatarViewModel?.decoratedAvatarViewModel;
  return avatarOf(
    model?.rendererContext?.commandContext?.onTap?.innertubeCommand?.browseEndpoint?.browseId,
    pickAvatar(model?.avatar?.avatarViewModel?.image?.sources),
  );
}

/** The video ID of the first likeEndpoint found in a button's data, or null. */
function likeTarget(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > MAX_COMMAND_DEPTH) return null;
  const target = value.likeEndpoint?.target?.videoId;
  if (typeof target === 'string') return target;
  for (const child of Object.values(value)) {
    const found = likeTarget(child, depth + 1);
    if (found) return found;
  }
  return null;
}

/** { toggled, videoId } from a toggle-button-view-model, null when absent. */
export function ratingAtLoad(toggle) {
  const data = toggle?.data;
  if (!data || typeof data !== 'object') return null;
  return {
    toggled: typeof data.isToggled === 'boolean' ? data.isToggled : null,
    videoId: guarded(() => likeTarget(data.defaultButtonViewModel)),
  };
}

/** likeStatus from the data of a Shorts action bar, or null. */
export function shortsLikeStatus(bar) {
  const buttons = bar?.data?.buttonViewModels;
  if (!Array.isArray(buttons)) return null;
  const status = buttons.find((button) => button?.likeButtonViewModel)?.likeButtonViewModel?.likeStatusEntity?.likeStatus;
  return typeof status === 'string' ? status : null;
}

function ratingsAtLoad(bar) {
  return {
    likeAtLoad: ratingAtLoad(bar?.querySelector(LIKE_TOGGLE)),
    dislikeAtLoad: ratingAtLoad(bar?.querySelector(DISLIKE_TOGGLE)),
  };
}

/**
 * In the Shorts player, likeStatus completes the button data: it marks the
 * video liked, and gives the dislike state when no dislike component exists.
 * It rates the same video as the like button of the same bar.
 */
function shortsRatingsAtLoad(bar) {
  const { likeAtLoad, dislikeAtLoad } = ratingsAtLoad(bar);
  const status = shortsLikeStatus(bar);
  if (status === null || !likeAtLoad) return { likeAtLoad, dislikeAtLoad };
  return {
    likeAtLoad: { ...likeAtLoad, toggled: likeAtLoad.toggled === true || status === 'LIKE' },
    dislikeAtLoad: dislikeAtLoad ?? { toggled: !NOT_DISLIKED_STATUSES.includes(status), videoId: likeAtLoad.videoId },
  };
}

function watchSources(doc) {
  const subscribed = doc.querySelector(WATCH_SUBSCRIBE)?.data?.subscribed;
  const owner = doc.querySelector(WATCH_OWNER);
  return {
    response: guarded(() => doc.querySelector(WATCH_PLAYER)?.getPlayer?.()?.getPlayerResponse?.()),
    surfaceVideoId: doc.querySelector(WATCH_PAGE)?.getAttribute('video-id') ?? null,
    subscribed: typeof subscribed === 'boolean' ? subscribed : null,
    avatar: guarded(() => watchOwnerAvatar(owner)),
    collaboration: guarded(() => watchCollaboration(owner)),
    ...ratingsAtLoad(doc.querySelector(WATCH_RATING_BAR)),
  };
}

/**
 * What a collaboration changes in the snapshot, once checked against the
 * channel of the player response (the owner element may still show the
 * previous video): the subscription and the avatar of that channel, the
 * other channels (guests), and the title naming them all. A collaboration
 * that does not list that channel leaves the subscription unknown.
 */
function collaborationParts(collaboration, channelId) {
  const publisher = collaboration.channels.find((channel) => channel.id === channelId);
  if (!publisher) return { subscribed: null, avatar: null, guests: [], channelsTitle: '' };
  return {
    subscribed: collaboration.subscribed,
    avatar: avatarOf(publisher.id, publisher.avatarUrl),
    guests: collaboration.channels.filter((channel) => channel.id !== channelId),
    channelsTitle: typeof collaboration.title === 'string' ? collaboration.title : '',
  };
}

function shortsSources(doc) {
  const player = doc.querySelector(SHORTS_PLAYER);
  const short = player?.closest(SHORT) ?? null;
  return {
    response: guarded(() => player?.getPlayerResponse?.()),
    surfaceVideoId: short?.data?.command?.reelWatchEndpoint?.videoId ?? null,
    subscribed: shortsSubscription(short),
    avatar: guarded(() => shortsBarAvatar(short)),
    ...shortsRatingsAtLoad(short?.querySelector(SHORTS_RATING_BAR)),
  };
}

/** Whether an account is signed in on YouTube, from its ytcfg; null when the page does not say. */
export function readSignedIn(ytcfg) {
  const loggedIn = guarded(() => ytcfg?.get?.('LOGGED_IN'));
  return typeof loggedIn === 'boolean' ? loggedIn : null;
}

/**
 * The snapshot sent to the liker (see validateSnapshot in protocol.js), for
 * the surface the URL shows; null when the page plays no video.
 *
 * @param {object} [ytcfg] window.ytcfg of the page.
 */
export function readSnapshot(doc, surface, ytcfg = null) {
  if (surface !== Surface.WATCH && surface !== Surface.SHORTS) return null;
  const sources = surface === Surface.SHORTS ? shortsSources(doc) : watchSources(doc);
  const { response, surfaceVideoId, likeAtLoad, dislikeAtLoad } = sources;
  const details = response?.videoDetails;
  const channelId = details?.channelId ?? null;
  const microformat = response?.microformat?.playerMicroformatRenderer;
  const { subscribed, avatar, guests, channelsTitle } = sources.collaboration
    ? collaborationParts(sources.collaboration, channelId)
    : { subscribed: sources.subscribed, avatar: sources.avatar, guests: [], channelsTitle: '' };
  return {
    videoId: details?.videoId ?? null,
    surfaceVideoId,
    title: typeof details?.title === 'string' ? details.title : '',
    channelId,
    channelName: details?.author ?? '',
    // avatarOf gives a channel ID only as a string: no avatar passes without one.
    avatarUrl: avatar?.channelId === channelId ? avatar.url : null,
    signedIn: readSignedIn(ytcfg),
    isShort:
      surface === Surface.SHORTS
        ? true
        : typeof microformat?.isShortsEligible === 'boolean'
          ? microformat.isShortsEligible
          : null,
    // videoDetails.isLive is only present on a stream that is live.
    isLive: details ? details.isLive === true : null,
    subscribed,
    guests,
    channelsTitle,
    likeAtLoad,
    dislikeAtLoad,
  };
}
