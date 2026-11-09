/**
 * Page reader, run in the MAIN world of YouTube pages: answers each request
 * of the liker with what only YouTube's own objects hold: the snapshot of
 * the video for the surface the URL shows, or the channel a channel page
 * shows. It reads, and never acts on the page. A newer copy of the reader,
 * injected again by the extension, takes over (see ../instance.js).
 */
import { claimInstance } from '../instance.js';
import { CHANNEL_PAGE, CHANNEL_PAGE_REQUEST, ISOLATED_SOURCE, PAGE_SOURCE, SNAPSHOT, SNAPSHOT_REQUEST } from '../protocol.js';
import { readChannelPage } from '../youtube/channel-page.js';
import { readSnapshot } from '../youtube/page-data.js';
import { surfaceFromUrl } from '../youtube/surface.js';

const hasTurn = claimInstance(window, Symbol.for('youtube-auto-like:page-reader'));

// Each request type, with the type of its answer and how to read it.
const ANSWERS = {
  [SNAPSHOT_REQUEST]: { type: SNAPSHOT, read: () => readSnapshot(document, surfaceFromUrl(window.location.href)) },
  [CHANNEL_PAGE_REQUEST]: { type: CHANNEL_PAGE, read: () => readChannelPage(document, window.location.href) },
};

function onMessage(event) {
  if (!hasTurn()) {
    window.removeEventListener('message', onMessage);
    return;
  }
  if (event.source !== window) return;
  const request = event.data;
  if (!request || request.source !== ISOLATED_SOURCE || typeof request.id !== 'string') return;
  const answer = Object.hasOwn(ANSWERS, request.type) ? ANSWERS[request.type] : null;
  if (!answer) return;
  window.postMessage({ source: PAGE_SOURCE, type: answer.type, id: request.id, payload: answer.read() }, window.location.origin);
}

window.addEventListener('message', onMessage);
