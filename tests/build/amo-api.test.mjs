import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { amoKeys, amoToken } from '../../scripts/lib/amo-api.mjs';

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

describe('amoKeys', () => {
  it('reads both keys from the environment, and refuses without one', () => {
    assert.deepEqual(amoKeys({ WEB_EXT_API_KEY: 'k', WEB_EXT_API_SECRET: 's' }), { key: 'k', secret: 's' });
    assert.throws(() => amoKeys({ WEB_EXT_API_KEY: 'k' }), /guichet/);
    assert.throws(() => amoKeys({}), /guichet/);
  });
});
