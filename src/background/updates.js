/**
 * One check for a new version: asks the GitHub API for the latest release,
 * and keeps the answer in storage (see normalizeUpdateState).
 *
 * The request is unauthenticated, so each one counts against GitHub's limit
 * of 60 requests an hour per IP address, 304 answers included. When the
 * limit is reached, GitHub's reset time is kept, and no request is made
 * before it. The ETag of the last answer is sent back, so that an unchanged
 * release costs no download.
 *
 * fetch and the store are passed in, so that every answer is tested
 * without a network.
 */
import { LATEST_RELEASE_API, parseLatestRelease } from '../core/update.js';

const LOG_PREFIX = '[YouTube Auto Like]';
// Waiting time when GitHub refuses without saying until when.
const DEFAULT_RETRY_MS = 60 * 60_000;

/** The date GitHub asks to wait until, from a refusal (403 or 429). */
function retryDate(headers, now) {
  const retryAfter = Number(headers.get('Retry-After'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return new Date(now + retryAfter * 1000);
  const reset = Number(headers.get('X-RateLimit-Reset'));
  if (Number.isFinite(reset) && reset * 1000 > now) return new Date(reset * 1000);
  return new Date(now + DEFAULT_RETRY_MS);
}

/**
 * @returns {Promise<object>} The new state of the checks.
 */
export async function checkForUpdate({ fetch, store, now = Date.now() }) {
  const state = await store.loadUpdateState();
  if (state.retryAfter && Date.parse(state.retryAfter) > now) return state;

  const headers = { Accept: 'application/vnd.github+json' };
  if (state.etag) headers['If-None-Match'] = state.etag;
  let response;
  try {
    // no-store: the ETag is handled here; the browser cache would answer
    // a 304 with its own copy, without the headers needed.
    response = await fetch(LATEST_RELEASE_API, { headers, cache: 'no-store' });
  } catch (error) {
    console.error(LOG_PREFIX, 'could not reach GitHub to look for a new version', error);
    return store.saveUpdateState({ ...state, failedAt: new Date(now).toISOString() });
  }

  const checkedAt = new Date(now).toISOString();
  if (response.status === 304) return store.saveUpdateState({ ...state, checkedAt, failedAt: null, retryAfter: null });
  if (response.status === 404) {
    // No release published yet.
    return store.saveUpdateState({ latest: null, checkedAt, etag: null, retryAfter: null, failedAt: null });
  }
  if (response.status === 403 || response.status === 429) {
    console.error(LOG_PREFIX, `GitHub refused the version check (HTTP ${response.status})`);
    return store.saveUpdateState({ ...state, retryAfter: retryDate(response.headers, now).toISOString(), failedAt: checkedAt });
  }
  if (!response.ok) {
    console.error(LOG_PREFIX, `unexpected answer to the version check (HTTP ${response.status})`);
    return store.saveUpdateState({ ...state, failedAt: checkedAt });
  }

  let json;
  try {
    json = await response.json();
  } catch (error) {
    console.error(LOG_PREFIX, 'the answer to the version check is not JSON', error);
    return store.saveUpdateState({ ...state, failedAt: checkedAt });
  }
  return store.saveUpdateState({
    latest: parseLatestRelease(json),
    checkedAt,
    etag: response.headers.get('ETag'),
    retryAfter: null,
    failedAt: null,
  });
}
