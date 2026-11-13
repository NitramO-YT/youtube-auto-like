import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { amoKeys, amoRequest, amoToken, retryDelaySeconds } from '../../scripts/lib/amo-api.mjs';

const KEYS = { key: 'user:12345:67', secret: 'not-a-real-secret' };
const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString());

describe('amoToken', () => {
  it('signs, with HS256 and the secret, a token issued by the key, valid one minute', () => {
    const token = amoToken(KEYS, 1_000_000, 'unique');
    const [head, body, signature] = token.split('.');
    assert.deepEqual(decode(head), { alg: 'HS256', typ: 'JWT' });
    assert.deepEqual(decode(body), { iss: KEYS.key, jti: 'unique', iat: 1_000_000, exp: 1_000_060 });
    assert.equal(signature, createHmac('sha256', KEYS.secret).update(`${head}.${body}`).digest('base64url'));
  });

  it('gives each token its own jti', () => {
    const jti = (token) => decode(token.split('.')[1]).jti;
    assert.notEqual(jti(amoToken(KEYS)), jti(amoToken(KEYS)));
  });
});

describe('a throttled request', () => {
  it('waits all that Retry-After says, and not at all past five minutes or without it', () => {
    assert.equal(retryDelaySeconds('58'), 58);
    assert.equal(retryDelaySeconds('300'), 300);
    for (const value of ['301', '1412', null, '', 'soon', '0', '-5']) assert.equal(retryDelaySeconds(value), null, String(value));
  });

  it('stops at once when the wait asked is too long, with the answer of the API', async (t) => {
    t.mock.method(globalThis, 'fetch', async () =>
      new Response('{"detail":"Expected available in 1412 seconds."}', { status: 429, headers: { 'Retry-After': '1412' } }),
    );
    let waited = 0;
    await assert.rejects(amoRequest(KEYS, 'GET', '/x/', undefined, { wait: async () => { waited += 1; } }), /1412 seconds/);
    assert.equal(waited, 0);
  });

  it('is sent again after the wait, with a new token, then gives the answer', async (t) => {
    const answers = [
      new Response('{"detail":"Request was throttled."}', { status: 429, headers: { 'Retry-After': '58' } }),
      new Response('{"id":42}', { status: 200 }),
    ];
    const tokens = [];
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      tokens.push(init.headers.Authorization);
      return answers.shift();
    });
    const waits = [];
    const answer = await amoRequest(KEYS, 'PATCH', '/previews/1/', { caption: {} }, { wait: async (s) => waits.push(s) });
    assert.deepEqual(answer, { id: 42 });
    assert.deepEqual(waits, [58]);
    assert.equal(tokens.length, 2);
    assert.notEqual(tokens[0], tokens[1]);
  });

  it('gives up after three retries', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 429, headers: { 'Retry-After': '1' } }));
    let waited = 0;
    await assert.rejects(amoRequest(KEYS, 'GET', '/x/', undefined, { wait: async () => { waited += 1; } }), /HTTP 429/);
    assert.equal(waited, 3);
  });
});

describe('amoKeys', () => {
  it('reads both keys from the environment, and refuses without one', () => {
    assert.deepEqual(amoKeys({ WEB_EXT_API_KEY: 'k', WEB_EXT_API_SECRET: 's' }), { key: 'k', secret: 's' });
    assert.throws(() => amoKeys({ WEB_EXT_API_KEY: 'k' }), /guichet/);
    assert.throws(() => amoKeys({}), /guichet/);
  });
});
