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
  return {
    response: guarded(() => doc.querySelector(WATCH_PLAYER)?.getPlayer?.()?.getPlayerResponse?.()),
    surfaceVideoId: doc.querySelector(WATCH_PAGE)?.getAttribute('video-id') ?? null,
    subscribed: typeof subscribed === 'boolean' ? subscribed : null,
    avatar: guarded(() => watchOwnerAvatar(doc.querySelector(WATCH_OWNER))),
    ...ratingsAtLoad(doc.querySelector(WATCH_RATING_BAR)),
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

/**
 * The snapshot sent to the liker (see validateSnapshot in protocol.js), for
 * the surface the URL shows; null when the page plays no video.
 */
export function readSnapshot(doc, surface) {
  if (surface !== Surface.WATCH && surface !== Surface.SHORTS) return null;
  const { response, surfaceVideoId, subscribed, avatar, likeAtLoad, dislikeAtLoad } =
    surface === Surface.SHORTS ? shortsSources(doc) : watchSources(doc);
  const details = response?.videoDetails;
  const channelId = details?.channelId ?? null;
  const microformat = response?.microformat?.playerMicroformatRenderer;
  return {
    videoId: details?.videoId ?? null,
    surfaceVideoId,
    title: typeof details?.title === 'string' ? details.title : '',
    channelId,
    channelName: details?.author ?? '',
    // avatarOf gives a channel ID only as a string: no avatar passes without one.
    avatarUrl: avatar?.channelId === channelId ? avatar.url : null,
    isShort:
      surface === Surface.SHORTS
        ? true
        : typeof microformat?.isShortsEligible === 'boolean'
          ? microformat.isShortsEligible
          : null,
    // videoDetails.isLive is only present on a stream that is live.
    isLive: details ? details.isLive === true : null,
    subscribed,
    likeAtLoad,
    dislikeAtLoad,
  };
}
