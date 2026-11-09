import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_LINKS } from '../../src/core/channel-links.js';
import { LookupError, lookUpLine, lookUpLines } from '../../src/ui/options/channel-lookup.js';

const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const AVATAR = 'https://yt3.googleusercontent.com/MVUN-H_w=s900-c-k-c0x00ffffff-no-rj';
const COLAS_PAGE =
  `<meta property="og:title" content="COLAS"><meta property="og:image" content="${AVATAR}">` +
  `<link rel="canonical" href="https://www.youtube.com/channel/${COLAS}">`;
const COLAS_CHANNEL = { id: COLAS, name: 'COLAS', avatarUrl: AVATAR };

/** A fetch answering as YouTube did on 9 November 2026, and recording what it was asked. */
function fakeYouTube(overrides = {}) {
  const asked = [];
  const answers = {
    'https://www.youtube.com/@COLAS.': { status: 200, body: COLAS_PAGE },
    [`https://www.youtube.com/channel/${COLAS}`]: { status: 200, body: COLAS_PAGE },
    'https://www.youtube.com/@nobody': { status: 404, body: '' },
    'https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DaeP4eG-gO10': {
      status: 200,
      body: JSON.stringify({ author_name: 'COLAS', author_url: 'https://www.youtube.com/@COLAS.' }),
    },
    'https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dzzzzzzzzzzz': { status: 400, body: 'Bad Request' },
    ...overrides,
  };
  const fetchImpl = async (url, options) => {
    asked.push({ url, credentials: options?.credentials });
    const answer = answers[url];
    if (!answer) throw new TypeError('Failed to fetch');
    if (answer.status === 'throw') throw new TypeError('Failed to fetch');
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      text: async () => answer.body,
      json: async () => JSON.parse(answer.body),
    };
  };
  return { fetchImpl, asked };
}

describe('lookUpLine', () => {
  it('finds a channel by handle, by ID and by one of its videos, with the YouTube cookies of the browser', async () => {
    const { fetchImpl, asked } = fakeYouTube();
    assert.deepEqual(await lookUpLine('@COLAS.', fetchImpl), { channel: COLAS_CHANNEL });
    assert.deepEqual(await lookUpLine(`https://www.youtube.com/channel/${COLAS}`, fetchImpl), { channel: COLAS_CHANNEL });
    assert.deepEqual(await lookUpLine('https://youtu.be/aeP4eG-gO10', fetchImpl), { channel: COLAS_CHANNEL });
    // Without them, a browser in the European Union gets the consent page.
    assert.ok(asked.every((request) => request.credentials === 'include'));
  });

  it('says when YouTube knows no such channel or video', async () => {
    const { fetchImpl } = fakeYouTube();
    assert.deepEqual(await lookUpLine('@nobody', fetchImpl), { error: LookupError.NOT_FOUND });
    assert.deepEqual(await lookUpLine('https://www.youtube.com/watch?v=zzzzzzzzzzz', fetchImpl), { error: LookupError.NOT_FOUND });
  });

  it('refuses what names no channel or video, without asking anything', async () => {
    const { fetchImpl, asked } = fakeYouTube();
    assert.deepEqual(await lookUpLine('https://evil.example/@COLAS.', fetchImpl), { error: LookupError.NOT_A_LINK });
    assert.deepEqual(asked, []);
  });

  it('keeps a channel ID without its name when YouTube does not answer as expected', async () => {
    for (const answer of [{ status: 'throw' }, { status: 200, body: '<html>consent</html>' }, { status: 500, body: '' }]) {
      const { fetchImpl } = fakeYouTube({ [`https://www.youtube.com/channel/${COLAS}`]: answer });
      assert.deepEqual(await lookUpLine(COLAS, fetchImpl), { channel: { id: COLAS, name: '', avatarUrl: null } });
    }
    const { fetchImpl } = fakeYouTube({ [`https://www.youtube.com/channel/${COLAS}`]: { status: 404, body: '' } });
    assert.deepEqual(await lookUpLine(COLAS, fetchImpl), { error: LookupError.NOT_FOUND });
  });

  it('does not trust a page that answers for another channel than the ID asked', async () => {
    const other = COLAS_PAGE.replace(COLAS, 'UCfefITu3BR2ix7ZUSrxj16w');
    const { fetchImpl } = fakeYouTube({ [`https://www.youtube.com/channel/${COLAS}`]: { status: 200, body: other } });
    assert.deepEqual(await lookUpLine(COLAS, fetchImpl), { channel: { id: COLAS, name: '', avatarUrl: null } });
  });

  it('cannot name a channel by handle or video without a usable answer', async () => {
    const { fetchImpl } = fakeYouTube({
      'https://www.youtube.com/@COLAS.': { status: 200, body: '<html>consent</html>' },
      'https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DaeP4eG-gO10': { status: 'throw' },
    });
    assert.deepEqual(await lookUpLine('@COLAS.', fetchImpl), { error: LookupError.UNREADABLE });
    assert.deepEqual(await lookUpLine('https://youtu.be/aeP4eG-gO10', fetchImpl), { error: LookupError.UNREADABLE });
  });
});

describe('lookUpLines', () => {
  it('looks the lines up one after the other, with their progress', async () => {
    const { fetchImpl } = fakeYouTube();
    const progress = [];
    const results = await lookUpLines(['@COLAS.', 'nope'], fetchImpl, (done, total) => progress.push([done, total]));
    assert.deepEqual(results, [
      { line: '@COLAS.', channel: COLAS_CHANNEL },
      { line: 'nope', error: LookupError.NOT_A_LINK },
    ]);
    assert.deepEqual(progress, [[1, 2], [2, 2]]);
  });

  it('refuses more lines than it looks up at once', async () => {
    const { fetchImpl, asked } = fakeYouTube();
    await assert.rejects(lookUpLines(Array.from({ length: MAX_LINKS + 1 }, (_, n) => `@c${n}`), fetchImpl), RangeError);
    assert.deepEqual(asked, []);
  });
});
