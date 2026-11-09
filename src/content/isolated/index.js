/**
 * Liker, run in the isolated world of YouTube pages. Once a second, and right
 * after each YouTube navigation, it observes the current video, lets step()
 * decide, and carries out the decision: the only action it ever takes on the
 * page is a click on the like button. It also answers the popup: the status
 * of the video and the commands on it (see COMMANDS), or, on a channel
 * page, the channel it shows.
 *
 * Between the moment step() is called and the moment its result is stored,
 * nothing is awaited: a command from the popup, applied to `session` in the
 * meantime, is therefore never overwritten by an older state.
 *
 * It stops for good once cut off from the extension (disabled, reloaded,
 * updated or removed), or once a newer copy of it runs in the page (see
 * ../instance.js): a page never keeps liking on settings it can no longer
 * read, and never holds two likers.
 */
import { historyEntry } from '../../core/history.js';
import { api } from '../../platform/api.js';
import { acceptedMessage, Message } from '../../platform/messages.js';
import { createStore } from '../../platform/storage.js';
import { claimInstance, isConnected } from '../instance.js';
import {
  CHANNEL_PAGE,
  CHANNEL_PAGE_REQUEST,
  ISOLATED_SOURCE,
  PAGE_SOURCE,
  SNAPSHOT,
  SNAPSHOT_REQUEST,
  validateChannelPage,
  validateSnapshot,
} from '../protocol.js';
import { channelRefFromUrl } from '../youtube/channel-page.js';
import { findLikeButton, readChannelAvatar, readPlayback, readRating } from '../youtube/dom.js';
import { surfaceFromUrl, videoIdFromUrl } from '../youtube/surface.js';
import { createSession, likeNow, restartVideo, resumeVideo, skipVideo, Status, step } from './session.js';
import { popupStatus } from './status.js';

const TICK_MS = 1000;
const SNAPSHOT_TIMEOUT_MS = 500;
const LOG_PREFIX = '[YouTube Auto Like]';

const store = createStore(api);
const hasTurn = claimInstance(globalThis, Symbol.for('youtube-auto-like:liker'));
let timer = null;
let stopped = false;
let settings = null;
let session = null;
let lastObservation = null;
// The observation of the page when the like button was clicked: step() had
// just checked that its snapshot describes the video of the session. The
// history entry is made from it, the page being possibly unreadable when
// the like confirms.
let clicked = null;
// On a channel page: { href, channel } read at that address, channel from
// validateChannelPage (null while the page does not show it yet).
let channelPage = null;
let busy = false;

function log(...args) {
  console.debug(LOG_PREFIX, ...args);
}

/** Whether this copy may go on: still connected to the extension, and the newest one in the page. */
function mayRun() {
  if (stopped) return false;
  if (hasTurn() && isConnected(api)) return true;
  stopped = true;
  clearInterval(timer);
  document.removeEventListener('yt-navigate-finish', onNavigate);
  console.info(LOG_PREFIX, hasTurn() ? 'cut off from the extension: this page no longer likes until it is reloaded' : 'a newer copy of the extension takes over');
  return false;
}

function onNavigate() {
  tick();
}

/**
 * Asks the page reader a question (SNAPSHOT_REQUEST or CHANNEL_PAGE_REQUEST)
 * and validates its answer; null if it does not answer in time.
 */
function askPage(requestType, answerType, validate) {
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
      if (!message || message.source !== PAGE_SOURCE || message.type !== answerType || message.id !== id) return;
      finish(validate(message.payload));
    };
    const timer = setTimeout(() => finish(null), SNAPSHOT_TIMEOUT_MS);
    window.addEventListener('message', onMessage);
    window.postMessage({ source: ISOLATED_SOURCE, type: requestType, id }, window.location.origin);
  });
}

const requestSnapshot = () => askPage(SNAPSHOT_REQUEST, SNAPSHOT, validateSnapshot);

/** Reads the channel of a channel page for the popup; channelPage stays null on any other page. */
async function readChannelPageOf(href) {
  if (!channelRefFromUrl(href)) {
    channelPage = null;
    return;
  }
  const channel = await askPage(CHANNEL_PAGE_REQUEST, CHANNEL_PAGE, validateChannelPage);
  // The page may have moved on while the reader answered.
  channelPage = window.location.href === href ? { href, channel } : null;
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
  if (busy || !settings || !mayRun()) return;
  busy = true;
  try {
    const videoId = videoIdFromUrl(window.location.href);
    if (!videoId) {
      session = null;
      lastObservation = null;
      await readChannelPageOf(window.location.href);
      return;
    }
    channelPage = null;
    if (!session || session.videoId !== videoId) {
      session = createSession(videoId, Date.now(), Math.random());
      lastObservation = null;
      clicked = null;
      log(`video ${videoId}`);
    }
    // A final video is still observed, for the popup and for a like the
    // user removes (see step); it is never clicked again.

    const surface = surfaceFromUrl(window.location.href);
    const snapshot = await requestSnapshot();
    // The page may have moved to another video while the reader answered,
    // and the extension may have been disabled or updated meanwhile.
    if (!mayRun()) return;
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
        clicked = observation;
      } else {
        next = { ...next, status: Status.CLICK_FAILED };
      }
    }

    if (next.status !== session.status || next.reason !== session.reason) {
      log(`video ${next.videoId}: ${describe(next)}`);
    }
    if (next.status === Status.LIKED && session.status !== Status.LIKED) {
      store
        .recordLike(historyEntry(next.videoId, clicked?.snapshot ?? null, next.likedAt, clicked?.avatarUrl ?? null))
        .catch((error) => console.error(LOG_PREFIX, 'could not record the like', error));
    }
    session = next;
    lastObservation = observation;
  } catch (error) {
    console.error(LOG_PREFIX, 'observation failed', error);
  } finally {
    busy = false;
  }
}

/**
 * The status sent to the popup; videoId null when the tab shows no video,
 * with then channelPage, the channel a channel page shows ({ id, name,
 * avatarUrl }), or null.
 */
function currentStatus() {
  const onVideo = session && session.videoId === videoIdFromUrl(window.location.href);
  if (onVideo && settings) return popupStatus(session, lastObservation, settings);
  const shown = channelPage?.href === window.location.href ? channelPage.channel : null;
  return { videoId: null, channelPage: shown };
}

// Commands of the popup on the video of the tab; each returns the new session.
const COMMANDS = {
  [Message.LIKE_NOW]: likeNow,
  [Message.SKIP_VIDEO]: skipVideo,
  [Message.RESUME_VIDEO]: resumeVideo,
  [Message.RESTART_VIDEO]: (current) => {
    clicked = null;
    return restartVideo(current, Date.now(), Math.random());
  },
};

function onPopupMessage(message, sender, sendResponse) {
  if (!mayRun()) return;
  const type = acceptedMessage(message, sender, api.runtime.id);
  if (!type) return;
  const onVideo = session && session.videoId === videoIdFromUrl(window.location.href);
  if (onVideo && COMMANDS[type]) {
    session = COMMANDS[type](session);
    log(`video ${session.videoId}: ${type}, ${describe(session)}`);
  }
  sendResponse(currentStatus());
  // The video is looked at again at once, rather than at the next tick.
  if (type === Message.LIKE_NOW || type === Message.RESUME_VIDEO || type === Message.RESTART_VIDEO) tick();
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
  document.addEventListener('yt-navigate-finish', onNavigate);
  timer = setInterval(tick, TICK_MS);
  tick();
}

start();
