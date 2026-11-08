/**
 * Page reader, run in the MAIN world of YouTube pages: answers each snapshot
 * request of the liker with what only YouTube's own objects hold, for the
 * surface the URL shows. It reads, and never acts on the page. A newer copy
 * of the reader, injected again by the extension, takes over (see
 * ../instance.js).
 */
import { claimInstance } from '../instance.js';
import { ISOLATED_SOURCE, PAGE_SOURCE, SNAPSHOT, SNAPSHOT_REQUEST } from '../protocol.js';
import { readSnapshot } from '../youtube/page-data.js';
import { surfaceFromUrl } from '../youtube/surface.js';

const hasTurn = claimInstance(window, Symbol.for('youtube-auto-like:page-reader'));

function onMessage(event) {
  if (!hasTurn()) {
    window.removeEventListener('message', onMessage);
    return;
  }
  if (event.source !== window) return;
  const request = event.data;
  if (!request || request.source !== ISOLATED_SOURCE || request.type !== SNAPSHOT_REQUEST) return;
  if (typeof request.id !== 'string') return;
  const payload = readSnapshot(document, surfaceFromUrl(window.location.href));
  window.postMessage({ source: PAGE_SOURCE, type: SNAPSHOT, id: request.id, payload }, window.location.origin);
}

window.addEventListener('message', onMessage);
