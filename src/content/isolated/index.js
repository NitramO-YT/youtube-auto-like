/**
 * Liker, run in the isolated world of YouTube pages. Once a second, and right
 * after each YouTube navigation, it observes the current video, lets step()
 * decide, and carries out the decision: the only action it ever takes on the
 * page is a click on the like button.
 */
import { api } from '../../platform/api.js';
import { createStore } from '../../platform/storage.js';
import { ISOLATED_SOURCE, PAGE_SOURCE, SNAPSHOT, SNAPSHOT_REQUEST, validateSnapshot } from '../protocol.js';
import { findLikeButton, readPlayback, readRating } from '../youtube/dom.js';
import { surfaceFromUrl, videoIdFromUrl } from '../youtube/surface.js';
import { createSession, isFinal, Status, step } from './session.js';

const TICK_MS = 1000;
const SNAPSHOT_TIMEOUT_MS = 500;
const LOG_PREFIX = '[YouTube Auto Like]';

const store = createStore(api);
let settings = null;
let session = null;
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
      return;
    }
    if (!session || session.videoId !== videoId) {
      session = createSession(videoId, Date.now(), Math.random());
      log(`video ${videoId}`);
    }
    if (isFinal(session)) return;

    const surface = surfaceFromUrl(window.location.href);
    const snapshot = await requestSnapshot();
    // The page may have moved to another video while the reader answered.
    if (videoIdFromUrl(window.location.href) !== session.videoId) return;
    if (surfaceFromUrl(window.location.href) !== surface) return;

    // From here to the click, nothing is awaited: the rating that step() saw
    // is still the one on the page when the button is clicked.
    let { session: next, action } = step(session, observe(snapshot, surface), settings, Date.now());
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
  } catch (error) {
    console.error(LOG_PREFIX, 'observation failed', error);
  } finally {
    busy = false;
  }
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
  document.addEventListener('yt-navigate-finish', () => tick());
  setInterval(tick, TICK_MS);
  tick();
}

start();
