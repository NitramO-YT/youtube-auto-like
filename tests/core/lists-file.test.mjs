import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeLists } from '../../src/core/channels.js';
import { ImportError, listsFileName, MAX_LISTS_FILE_BYTES, parseListsFile, serializeLists } from '../../src/core/lists-file.js';

const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const QOQSIK = 'UCfefITu3BR2ix7ZUSrxj16w';
const lists = normalizeLists({
  always: [{ id: COLAS, name: 'COLAS', addedAt: '2026-11-08T21:00:00.000Z' }],
  never: [{ id: QOQSIK, name: 'qoqsik', addedAt: null }],
});
const excludedVideos = [{ videoId: 'EkDC9elBHHc', title: 'le moooonstre', channelName: 'COLAS', isShort: true, addedAt: '2026-11-08T21:30:00.000Z' }];

describe('lists file', () => {
  it('reads back what it exports', () => {
    const text = serializeLists(lists, excludedVideos, '2026-11-08T22:00:00.000Z');
    assert.deepEqual(parseListsFile(text, text.length), { lists, excludedVideos });
  });

  it('reads a file without excluded videos', () => {
    const text = JSON.stringify({ format: 'youtube-auto-like/channel-lists', version: 1, always: lists.always, never: lists.never });
    assert.deepEqual(parseListsFile(text, text.length), { lists, excludedVideos: [] });
  });

  it('names the file after the day of the export', () => {
    assert.equal(listsFileName(new Date('2026-11-08T22:00:00.000Z')), 'youtube-auto-like-lists-2026-11-08.json');
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
      lists: { always: [{ id: COLAS, name: 'COLAS', addedAt: null }], never: [] },
      excludedVideos: [{ videoId: 'EkDC9elBHHc', title: '', channelName: '', isShort: false, addedAt: null }],
    });
  });

  it('refuses a file too large, not JSON, or of another format or version', () => {
    assert.deepEqual(parseListsFile('{}', MAX_LISTS_FILE_BYTES + 1), { error: ImportError.TOO_BIG });
    for (const text of ['not json', 'null', '[]', '{"always":[]}', '{"format":"youtube-auto-like/channel-lists","version":2,"always":[]}']) {
      assert.deepEqual(parseListsFile(text, text.length), { error: ImportError.INVALID }, text);
    }
  });
});
