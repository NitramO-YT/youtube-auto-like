/**
 * Liker, run in the isolated world of YouTube pages. Once a second, and right
 * after each YouTube navigation, it observes the current video, lets step()
 * decide, and carries out the decision: the only action it ever takes on the
 * page is a click on the like button. It also answers the popup: the status
 * of the video, "like now" and "not this video".
 *
 * Between the moment step() is called and the moment its result is stored,
 * nothing is awaited: a command from the popup, applied to `session` in the
 * meantime, is therefore never overwritten by an older state.
 */
import { api } from '../../platform/api.js';
import { acceptedMessage, Message } from '../../platform/messages.js';
import { createStore } from '../../platform/storage.js';
import { ISOLATED_SOURCE, PAGE_SOURCE, SNAPSHOT, SNAPSHOT_REQUEST, validateSnapshot } from '../protocol.js';
import { findLikeButton, readChannelAvatar, readPlayback, readRating } from '../youtube/dom.js';
import { surfaceFromUrl, videoIdFromUrl } from '../youtube/surface.js';
import { createSession, isFinal, likeNow, skipVideo, Status, step } from './session.js';
import { popupStatus } from './status.js';

const TICK_MS = 1000;
const SNAPSHOT_TIMEOUT_MS = 500;
const LOG_PREFIX = '[YouTube Auto Like]';

const store = createStore(api);
let settings = null;
let session = null;
let lastObservation = null;
let busy = false;

function log(...args) {
  console.debug(LOG_PREFIX, ...args);
}

/** Asks the page reader for its snapshot; null if it does not answer in time. */
function requestSnapshot() {
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const finish = (value) => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(value);
    };
    const onMessage = (event) => {
      if (event.source !== window) return;
      const message = event.data;
      if (!message || message.source !== PAGE_SOURCE || message.type !== SNAPSHOT || message.id !== id) return;
      finish(validateSnapshot(message.payload));
    };
    const timer = setTimeout(() => finish(null), SNAPSHOT_TIMEOUT_MS);
    window.addEventListener('message', onMessage);
    window.postMessage({ source: ISOLATED_SOURCE, type: SNAPSHOT_REQUEST, id }, window.location.origin);
  });
}

function observe(snapshot, surface) {
  return {
    snapshot,
    avatarUrl: readChannelAvatar(document, surface),
    ...readRating(document, surface),
    ...readPlayback(document, surface),
  };
}

function describe(current) {
  const parts = [current.status];
  if (current.reason) parts.push(current.reason);
  if (current.target) parts.push(`at ${Math.round(current.target.at)} s (${current.target.basis})`);
  return parts.join(', ');
}

async function tick() {
  if (busy || !settings) return;
  busy = true;
  try {
    const videoId = videoIdFromUrl(window.location.href);
    if (!videoId) {
      session = null;
      lastObservation = null;
      return;
    }
    if (!session || session.videoId !== videoId) {
      session = createSession(videoId, Date.now(), Math.random());
      lastObservation = null;
      log(`video ${videoId}`);
    }
    if (isFinal(session)) return;

    const surface = surfaceFromUrl(window.location.href);
    const snapshot = await requestSnapshot();
    // The page may have moved to another video while the reader answered.
    if (!session || videoIdFromUrl(window.location.href) !== session.videoId) return;
    if (surfaceFromUrl(window.location.href) !== surface) return;

    // From here to the click, nothing is awaited: the rating that step() saw
    // is still the one on the page when the button is clicked.
    const observation = observe(snapshot, surface);
    let { session: next, action } = step(session, observation, settings, Date.now());
    if (action === 'click') {
      const button = findLikeButton(document, surface);
      if (button) {
        button.click();
      } else {
        next = { ...next, status: Status.CLICK_FAILED };
      }
    }

    if (next.status !== session.status || next.reason !== session.reason) {
      log(`video ${next.videoId}: ${describe(next)}`);
    }
    if (next.status === Status.LIKED && session.status !== Status.LIKED) {
      store.incrementLikeCount().catch((error) => console.error(LOG_PREFIX, 'could not update the like count', error));
    }
    session = next;
    lastObservation = observation;
  } catch (error) {
    console.error(LOG_PREFIX, 'observation failed', error);
  } finally {
    busy = false;
  }
}

/** The status sent to the popup; videoId null when the tab shows no video. */
function currentStatus() {
  const onVideo = session && session.videoId === videoIdFromUrl(window.location.href);
  return onVideo && settings ? popupStatus(session, lastObservation, settings) : { videoId: null };
}

function onPopupMessage(message, sender, sendResponse) {
  const type = acceptedMessage(message, sender, api.runtime.id);
  if (!type) return;
  const onVideo = session && session.videoId === videoIdFromUrl(window.location.href);
  if (onVideo && type === Message.LIKE_NOW) {
    session = likeNow(session);
    log(`video ${session.videoId}: like now requested`);
  }
  if (onVideo && type === Message.SKIP_VIDEO) {
    session = skipVideo(session);
    log(`video ${session.videoId}: ${describe(session)}`);
  }
  sendResponse(currentStatus());
  if (type === Message.LIKE_NOW) tick();
}

async function start() {
  try {
    settings = await store.loadSettings();
  } catch (error) {
    console.error(LOG_PREFIX, 'could not load the settings; the extension stays inactive on this page', error);
    return;
  }
  store.onSettingsChange((updated) => {
    settings = updated;
  });
  api.runtime.onMessage.addListener(onPopupMessage);
  document.addEventListener('yt-navigate-finish', () => tick());
  setInterval(tick, TICK_MS);
  tick();
}

start();
