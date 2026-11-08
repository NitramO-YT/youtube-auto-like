/**
 * Data that only YouTube's own objects hold, read from the MAIN world.
 * Paths checked in Brave on 8 November 2026; when YouTube changes, this file
 * is where the reading breaks.
 *
 * Watch page:
 * - ytd-watch-flexy ytd-player .getPlayer().getPlayerResponse(): videoDetails
 *   (videoId, channelId, author, isLive) and microformat
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
 * Every access is guarded: a missing piece gives null, never an exception.
 */
import { Surface } from './surface.js';

const WATCH_PAGE = 'ytd-watch-flexy';
const WATCH_PLAYER = 'ytd-watch-flexy ytd-player';
const WATCH_SUBSCRIBE = 'ytd-watch-metadata ytd-subscribe-button-renderer';
const SHORTS_PLAYER = '#shorts-player';
const SHORT = 'ytd-reel-video-renderer';
const SHORTS_CHANNEL_BAR = 'yt-reel-channel-bar-view-model';
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

function watchSources(doc) {
  const subscribed = doc.querySelector(WATCH_SUBSCRIBE)?.data?.subscribed;
  return {
    response: guarded(() => doc.querySelector(WATCH_PLAYER)?.getPlayer?.()?.getPlayerResponse?.()),
    surfaceVideoId: doc.querySelector(WATCH_PAGE)?.getAttribute('video-id') ?? null,
    subscribed: typeof subscribed === 'boolean' ? subscribed : null,
  };
}

function shortsSources(doc) {
  const player = doc.querySelector(SHORTS_PLAYER);
  const short = player?.closest(SHORT) ?? null;
  return {
    response: guarded(() => player?.getPlayerResponse?.()),
    surfaceVideoId: short?.data?.command?.reelWatchEndpoint?.videoId ?? null,
    subscribed: shortsSubscription(short),
  };
}

/**
 * The snapshot sent to the liker (see validateSnapshot in protocol.js), for
 * the surface the URL shows; null when the page plays no video.
 */
export function readSnapshot(doc, surface) {
  if (surface !== Surface.WATCH && surface !== Surface.SHORTS) return null;
  const { response, surfaceVideoId, subscribed } =
    surface === Surface.SHORTS ? shortsSources(doc) : watchSources(doc);
  const details = response?.videoDetails;
  const microformat = response?.microformat?.playerMicroformatRenderer;
  return {
    videoId: details?.videoId ?? null,
    surfaceVideoId,
    channelId: details?.channelId ?? null,
    channelName: details?.author ?? '',
    isShort:
      surface === Surface.SHORTS
        ? true
        : typeof microformat?.isShortsEligible === 'boolean'
          ? microformat.isShortsEligible
          : null,
    // videoDetails.isLive is only present on a stream that is live.
    isLive: details ? details.isLive === true : null,
    subscribed,
  };
}
