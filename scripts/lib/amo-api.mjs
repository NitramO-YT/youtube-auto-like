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

/**
 * One request to the API; returns the JSON answer (null for an empty one),
 * or throws with the status and the answer of the API.
 */
export async function amoRequest(keys, method, apiPath, body) {
  const headers = { Authorization: `JWT ${amoToken(keys)}` };
  const init = { method, headers };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${AMO_API}${apiPath}`, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${apiPath}: HTTP ${response.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}
