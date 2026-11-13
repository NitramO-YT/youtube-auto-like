/**
 * Calls to the API v5 of addons.mozilla.org, authenticated as web-ext does:
 * a JWT signed with HMAC-SHA256 from the keys in WEB_EXT_API_KEY (issuer)
 * and WEB_EXT_API_SECRET, valid one minute, with a unique jti
 * ("Authentication (external)" in the API documentation).
 */
import { createHmac, randomUUID } from 'node:crypto';

export const AMO_API = 'https://addons.mozilla.org/api/v5';
const TOKEN_LIFETIME_S = 60;

const base64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

/** A JWT for one request; now in seconds. */
export function amoToken({ key, secret }, now = Math.floor(Date.now() / 1000), jti = randomUUID()) {
  const head = base64url({ alg: 'HS256', typ: 'JWT' });
  const body = base64url({ iss: key, jti, iat: now, exp: now + TOKEN_LIFETIME_S });
  const signature = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
}

/** The keys from the environment, or an error saying how to give them. */
export function amoKeys(env = process.env) {
  if (!env.WEB_EXT_API_KEY || !env.WEB_EXT_API_SECRET) {
    throw new Error('Mozilla keys missing: run it through the guichet (guichet exec amo-api-key -- guichet exec amo-api-secret -- …).');
  }
  return { key: env.WEB_EXT_API_KEY, secret: env.WEB_EXT_API_SECRET };
}

// A request throttled by the API (HTTP 429) is sent again after the whole
// wait its Retry-After header gives, when that wait is short. Seen on
// 13 November 2026, after a few writes in a row: "Expected available in 58
// seconds", then, each request sent before that time lengthening it, 1412
// seconds: a longer wait is not waited for, the error says it instead.
const MAX_RETRIES = 3;
export const MAX_WAIT_S = 300;

/**
 * The seconds to wait before sending a throttled request again, from
 * Retry-After; null when the API gives none, or more than MAX_WAIT_S.
 */
export function retryDelaySeconds(retryAfter) {
  const seconds = Number.parseInt(retryAfter ?? '', 10);
  return Number.isFinite(seconds) && seconds > 0 && seconds <= MAX_WAIT_S ? seconds : null;
}

/**
 * One request to the API; returns the JSON answer (null for an empty one),
 * or throws with the status and the answer of the API.
 */
export async function amoRequest(keys, method, apiPath, body, { wait = (s) => new Promise((done) => setTimeout(done, s * 1000)) } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    // A new token each time: one is valid a minute, and its jti once.
    const headers = { Authorization: `JWT ${amoToken(keys)}` };
    const init = { method, headers };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const response = await fetch(`${AMO_API}${apiPath}`, init);
    const text = await response.text();
    const seconds = response.status === 429 ? retryDelaySeconds(response.headers.get('retry-after')) : null;
    if (seconds !== null && attempt < MAX_RETRIES) {
      console.log(`${method} ${apiPath}: throttled by addons.mozilla.org, sent again in ${seconds} s`);
      await wait(seconds);
      continue;
    }
    if (!response.ok) throw new Error(`${method} ${apiPath}: HTTP ${response.status} ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : null;
  }
}
