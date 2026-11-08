/**
 * Data that only YouTube's own objects hold, read from the MAIN world.
 * Paths checked in Brave on 8 November 2026; when YouTube changes, this file
 * is where the reading breaks:
 *
 * - ytd-player .getPlayer().getPlayerResponse(): videoDetails (videoId,
 *   channelId, author, isLive) and microformat.playerMicroformatRenderer
 *   .isShortsEligible, which stays true for a Short opened in the regular
 *   watch player by a redirecting extension.
 * - ytd-watch-metadata ytd-subscribe-button-renderer .data.subscribed.
 *
 * Every access is guarded: a missing piece gives null, never an exception.
 */

const PLAYER_SELECTOR = 'ytd-player';
const SUBSCRIBE_SELECTOR = 'ytd-watch-metadata ytd-subscribe-button-renderer';

function playerResponse(doc) {
  try {
    return doc.querySelector(PLAYER_SELECTOR)?.getPlayer?.()?.getPlayerResponse?.() ?? null;
  } catch {
    // A player that is being torn down or rebuilt can throw; the next read
    // will see the new one.
    return null;
  }
}

/** The snapshot sent to the liker; see validateSnapshot in protocol.js. */
export function readSnapshot(doc) {
  const response = playerResponse(doc);
  const details = response?.videoDetails;
  const microformat = response?.microformat?.playerMicroformatRenderer;
  const subscribed = doc.querySelector(SUBSCRIBE_SELECTOR)?.data?.subscribed;
  return {
    videoId: details?.videoId ?? null,
    channelId: details?.channelId ?? null,
    channelName: details?.author ?? '',
    isShort: typeof microformat?.isShortsEligible === 'boolean' ? microformat.isShortsEligible : null,
    // videoDetails.isLive is only present on a stream that is live.
    isLive: details ? details.isLive === true : null,
    subscribed: typeof subscribed === 'boolean' ? subscribed : null,
  };
}
