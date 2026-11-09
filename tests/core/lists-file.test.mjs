import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_STORED_AVATAR_URL_LENGTH } from '../../src/core/avatar.js';
import { MAX_CHANNELS, MAX_NAME_LENGTH, normalizeLists } from '../../src/core/channels.js';
import {
  MAX_EXCLUDED_VIDEOS,
  MAX_NAME_LENGTH as MAX_VIDEO_CHANNEL_NAME_LENGTH,
  MAX_TITLE_LENGTH,
  normalizeExcludedVideos,
} from '../../src/core/excluded-videos.js';
import {
  ImportError,
  linksFileName,
  listsFileName,
  MAX_LISTS_FILE_BYTES,
  parseListsFile,
  readLinkLines,
  serializeLinks,
  serializeLists,
} from '../../src/core/lists-file.js';

const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const QOQSIK = 'UCfefITu3BR2ix7ZUSrxj16w';
const AVATAR = 'https://yt3.googleusercontent.com/3fhLCThebQlwuSDXM9SEapaTSVFB3EuXHCKtDzFhnugoLLb71I05xsU_yi5-qLMoT0Ve4PQQ=s88-c-k-c0x00ffffff-no-rj-mo';
const lists = normalizeLists({
  always: [{ id: COLAS, name: 'COLAS', avatarUrl: AVATAR, addedAt: '2026-11-08T21:00:00.000Z' }],
  never: [{ id: QOQSIK, name: 'qoqsik', addedAt: null }],
});
const excludedVideos = normalizeExcludedVideos([
  { videoId: 'EkDC9elBHHc', title: 'le moooonstre', channelName: 'COLAS', channelAvatarUrl: AVATAR, isShort: true, addedAt: '2026-11-08T21:30:00.000Z' },
]);

describe('lists file', () => {
  it('reads back what it exports, avatars included', () => {
    const text = serializeLists(lists, excludedVideos, '2026-11-08T22:00:00.000Z');
    assert.equal(lists.always[0].avatarUrl, AVATAR);
    assert.equal(excludedVideos[0].channelAvatarUrl, AVATAR);
    assert.deepEqual(parseListsFile(text, text.length), { lists, excludedVideos });
  });

  it('accepts back the largest export the extension can make', () => {
    // Characters taking three bytes in UTF-8, every text and list at its maximum.
    const longest = (length) => '漢'.repeat(length);
    const avatar = `https://yt3.ggpht.com/${'a'.repeat(MAX_STORED_AVATAR_URL_LENGTH - 'https://yt3.ggpht.com/'.length)}`;
    const date = '2026-11-09T12:00:00.000Z';
    const channel = (n) => ({ id: `UC${String(n).padStart(22, '0')}`, name: longest(MAX_NAME_LENGTH), avatarUrl: avatar, addedAt: date });
    const full = normalizeLists({
      always: Array.from({ length: MAX_CHANNELS }, (_, n) => channel(n)),
      never: Array.from({ length: MAX_CHANNELS }, (_, n) => channel(MAX_CHANNELS + n)),
    });
    const videos = normalizeExcludedVideos(
      Array.from({ length: MAX_EXCLUDED_VIDEOS }, (_, n) => ({
        videoId: String(n).padStart(11, '0'),
        title: longest(MAX_TITLE_LENGTH),
        channelName: longest(MAX_VIDEO_CHANNEL_NAME_LENGTH),
        channelAvatarUrl: avatar,
        addedAt: date,
      })),
    );
    assert.equal(full.always.length + full.never.length, 2 * MAX_CHANNELS);
    assert.equal(full.always[0].avatarUrl, avatar);
    const text = serializeLists(full, videos, date);
    const size = Buffer.byteLength(text);
    assert.ok(size <= MAX_LISTS_FILE_BYTES, `${size} bytes`);
    assert.ok(!parseListsFile(text, size).error);
  });

  it('reads a file without excluded videos', () => {
    const text = JSON.stringify({ format: 'youtube-auto-like/channel-lists', version: 1, always: lists.always, never: lists.never });
    assert.deepEqual(parseListsFile(text, text.length), { lists, excludedVideos: [] });
  });

  it('names the file after the day of the export', () => {
    assert.equal(listsFileName(new Date('2026-11-08T22:00:00.000Z')), 'youtube-auto-like-lists-2026-11-08.json');
    assert.equal(linksFileName(new Date('2026-11-08T22:00:00.000Z')), 'youtube-auto-like-channels-2026-11-08.txt');
  });

  it('writes a list of links that reads back as the channel addresses', () => {
    const text = serializeLinks([
      { title: 'Toujours liker', channels: lists.always },
      { title: 'Ne jamais liker', channels: [{ id: QOQSIK, name: '' }] },
    ]);
    assert.equal(
      text,
      `# Toujours liker\nhttps://www.youtube.com/channel/${COLAS}  # COLAS\n\n# Ne jamais liker\nhttps://www.youtube.com/channel/${QOQSIK}\n`,
    );
    assert.deepEqual(readLinkLines(text), [`https://www.youtube.com/channel/${COLAS}`, `https://www.youtube.com/channel/${QOQSIK}`]);
  });

  it('reads pasted lines trimmed, once, without comments or empty lines', () => {
    assert.deepEqual(readLinkLines(' @COLAS. \r\n\n@COLAS.  # again\n  \n# note\nhttps://youtu.be/aeP4eG-gO10#t=1'), [
      '@COLAS.',
      'https://youtu.be/aeP4eG-gO10#t=1',
    ]);
  });

  it('keeps only valid channels, valid videos and known fields', () => {
    const text = JSON.stringify({
      format: 'youtube-auto-like/channel-lists',
      version: 1,
      always: [{ id: COLAS, name: 'COLAS', script: '<img onerror=alert(1)>' }, { id: 'not a channel' }, 'text'],
      never: 'nope',
      excludedVideos: [{ videoId: 'bad' }, { videoId: 'EkDC9elBHHc', onload: 'x' }],
      settings: { enabled: false },
    });
    assert.deepEqual(parseListsFile(text, text.length), {
      lists: { always: [{ id: COLAS, name: 'COLAS', avatarUrl: null, addedAt: null }], never: [] },
      excludedVideos: [{ videoId: 'EkDC9elBHHc', title: '', channelName: '', channelAvatarUrl: null, isShort: false, addedAt: null }],
    });
  });

  it('refuses a file too large, not JSON, or of another format or version', () => {
    assert.deepEqual(parseListsFile('{}', MAX_LISTS_FILE_BYTES + 1), { error: ImportError.TOO_BIG });
    for (const text of ['not json', 'null', '[]', '{"always":[]}', '{"format":"youtube-auto-like/channel-lists","version":2,"always":[]}']) {
      assert.deepEqual(parseListsFile(text, text.length), { error: ImportError.INVALID }, text);
    }
  });
});
