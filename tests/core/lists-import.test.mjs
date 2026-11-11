import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ListFullError, listOf, MAX_CHANNELS, normalizeChannels, normalizeLists } from '../../src/core/channels.js';
import { normalizeExcludedVideos } from '../../src/core/excluded-videos.js';
import { MAX_HISTORY, normalizeHistory } from '../../src/core/history.js';
import { settingsWithoutLists } from '../../src/core/lists-file.js';
import { importChanges, ImportMode, planImport } from '../../src/core/lists-import.js';
import { normalizeSettings } from '../../src/core/settings.js';

const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const QOQSIK = 'UCfefITu3BR2ix7ZUSrxj16w';
const WAKED = 'UChQjbzNlo8xD154bJS3yb8A';
const ONE = `UC${'1'.repeat(22)}`;
const OLD = '2026-01-01T00:00:00.000Z';
const NOW = '2026-11-09T12:00:00.000Z';
const AVATAR = 'https://yt3.googleusercontent.com/3fhLCThebQlwuSDXM9SEapaTSVFB3EuXHCKtDzFhnugoLLb71I05xsU_yi5-qLMoT0Ve4PQQ=s88-c-k-c0x00ffffff-no-rj-mo';

const current = {
  lists: normalizeLists({
    always: [{ id: COLAS, name: 'COLAS', addedAt: OLD }],
    never: [{ id: QOQSIK, name: 'qoqsik', addedAt: OLD }],
  }),
  excludedVideos: normalizeExcludedVideos([{ videoId: 'aeP4eG-gO10', title: 'Atelier', addedAt: OLD }]),
};
const ids = (list) => list.map((entry) => entry.id ?? entry.videoId);
const counts = (added, moved, unchanged, removed) => ({ added, moved, unchanged, removed });

describe('planImport', () => {
  it('adds the imported channels in their order, with their dates, and leaves the parts not imported alone', () => {
    const incoming = normalizeLists({ always: [{ id: WAKED, name: 'Waked XY', addedAt: OLD }, { id: ONE, name: 'One' }] });
    const { lists, excludedVideos, report } = planImport(current, { always: incoming.always }, ImportMode.ADD_NEW, NOW);
    assert.deepEqual(ids(lists.always), [WAKED, ONE, COLAS]);
    assert.equal(lists.always[0].addedAt, OLD);
    assert.equal(lists.always[1].addedAt, NOW);
    assert.deepEqual(lists.never, current.lists.never);
    assert.equal(excludedVideos, current.excludedVideos);
    assert.deepEqual(report, { always: counts(2, 0, 0, 0) });
  });

  it('in ADD_NEW, leaves a channel already in a list where it is, untouched', () => {
    const incoming = normalizeLists({ always: [{ id: QOQSIK, name: 'renamed', avatarUrl: AVATAR }, { id: COLAS, name: 'renamed' }] });
    const { lists, report } = planImport(current, { always: incoming.always }, ImportMode.ADD_NEW, NOW);
    assert.deepEqual(lists, current.lists);
    assert.deepEqual(report, { always: counts(0, 0, 2, 0) });
    assert.equal(importChanges(report), false);
  });

  it('in FOLLOW, moves a channel to the list the import gives it and refreshes one already there', () => {
    const incoming = normalizeLists({ always: [{ id: QOQSIK, name: 'Qoqsik' }, { id: COLAS, name: 'COLAS!', avatarUrl: AVATAR }] });
    const { lists, report } = planImport(current, { always: incoming.always }, ImportMode.FOLLOW, NOW);
    assert.equal(listOf(lists, QOQSIK), 'always');
    assert.deepEqual(lists.never, []);
    const colas = lists.always.find((channel) => channel.id === COLAS);
    assert.deepEqual(colas, { id: COLAS, name: 'COLAS!', avatarUrl: AVATAR, addedAt: OLD });
    assert.deepEqual(report, { always: counts(0, 1, 1, 0) });
  });

  it('in REPLACE, takes out of each imported part what the import does not hold', () => {
    const incoming = normalizeLists({ always: [{ id: WAKED, name: 'Waked XY' }], never: [] });
    const videos = normalizeExcludedVideos([{ videoId: 'EkDC9elBHHc', title: 'le moooonstre' }]);
    const { lists, excludedVideos, report } = planImport(current, { ...incoming, videos }, ImportMode.REPLACE, NOW);
    assert.deepEqual(lists, { always: [{ id: WAKED, name: 'Waked XY', avatarUrl: null, addedAt: NOW }], never: [] });
    assert.deepEqual(ids(excludedVideos), ['EkDC9elBHHc']);
    assert.deepEqual(report, { always: counts(1, 0, 0, 1), never: counts(0, 0, 0, 1), videos: counts(1, 0, 0, 1) });
  });

  it('in REPLACE, counts a channel going to the other list as moved, not as removed and added', () => {
    const incoming = normalizeLists({ always: [], never: [{ id: COLAS, name: 'COLAS' }, { id: QOQSIK, name: 'qoqsik' }] });
    const { lists, report } = planImport(current, incoming, ImportMode.REPLACE, NOW);
    assert.deepEqual(ids(lists.never), [COLAS, QOQSIK]);
    assert.deepEqual(report, { always: counts(0, 0, 0, 0), never: counts(0, 1, 1, 0) });
  });

  it('in REPLACE of one list, moves a channel of the other list, dated from the move', () => {
    const incoming = normalizeLists({ always: [{ id: QOQSIK, name: 'qoqsik' }] });
    const { lists, report } = planImport(current, { always: incoming.always }, ImportMode.REPLACE, NOW);
    assert.deepEqual(lists, { always: [{ id: QOQSIK, name: 'qoqsik', avatarUrl: null, addedAt: NOW }], never: [] });
    assert.deepEqual(report, { always: counts(0, 1, 0, 1) });
  });

  it('adds the excluded videos in their order, with their dates, and leaves those already there as they are', () => {
    const videos = normalizeExcludedVideos([
      { videoId: 'EkDC9elBHHc', addedAt: OLD },
      { videoId: 'aeP4eG-gO10', title: 'other' },
      { videoId: 'zYHv6J4AH8k' },
    ]);
    const { excludedVideos, report } = planImport(current, { videos }, ImportMode.FOLLOW, NOW);
    assert.deepEqual(ids(excludedVideos), ['EkDC9elBHHc', 'zYHv6J4AH8k', 'aeP4eG-gO10']);
    assert.equal(excludedVideos[0].addedAt, OLD);
    assert.equal(excludedVideos[2].title, 'Atelier');
    assert.deepEqual(report, { videos: counts(2, 0, 1, 0) });
    assert.ok(importChanges(report));
  });

  it('refuses an unknown mode, and changes nothing when a list would be full', () => {
    assert.throws(() => planImport(current, {}, 'merge', NOW), /Unknown import mode/);
    const full = { ...current, lists: { always: normalizeChannels(Array.from({ length: MAX_CHANNELS }, (_, n) => ({ id: `UC${String(n).padStart(22, '0')}` }))), never: [] } };
    assert.throws(() => planImport(full, { always: [{ id: COLAS, name: 'COLAS', avatarUrl: null, addedAt: null }] }, ImportMode.ADD_NEW, NOW), ListFullError);
  });

  it('leaves its input unchanged', () => {
    const copy = structuredClone(current);
    planImport(current, normalizeLists({ always: [{ id: QOQSIK }], never: [] }), ImportMode.REPLACE, NOW);
    assert.deepEqual(current, copy);
  });
});

describe('planImport details', () => {
  const fates = (details) => details.map(({ fate, entry, from }) => [fate, entry.id ?? entry.videoId, from]);

  it('names each entry with what happens to it, those that change first', () => {
    const incoming = normalizeLists({ always: [{ id: COLAS, name: 'COLAS' }, { id: QOQSIK, name: 'qoqsik' }, { id: WAKED, name: 'Waked XY' }] });
    const { details } = planImport(current, { always: incoming.always }, ImportMode.FOLLOW, NOW);
    assert.deepEqual(fates(details.always), [
      ['added', WAKED, null],
      ['moved', QOQSIK, 'never'],
      ['unchanged', COLAS, null],
    ]);
  });

  it('says where a channel stays when only the new ones are added', () => {
    const incoming = normalizeLists({ always: [{ id: QOQSIK, name: 'qoqsik' }] });
    assert.deepEqual(fates(planImport(current, { always: incoming.always }, ImportMode.ADD_NEW, NOW).details.always), [['unchanged', QOQSIK, 'never']]);
  });

  it('names what a replacement takes out, channels and videos', () => {
    const incoming = normalizeLists({ always: [{ id: WAKED, name: 'Waked XY' }], never: [] });
    const videos = normalizeExcludedVideos([{ videoId: '82DBD5efxMc', title: 'Paris' }]);
    const { details, report } = planImport(current, { ...incoming, videos }, ImportMode.REPLACE, NOW);
    assert.deepEqual(fates(details.always), [['added', WAKED, null], ['removed', COLAS, null]]);
    assert.deepEqual(fates(details.never), [['removed', QOQSIK, null]]);
    assert.deepEqual(fates(details.videos), [['added', '82DBD5efxMc', null], ['removed', 'aeP4eG-gO10', null]]);
    for (const part of ['always', 'never', 'videos']) {
      const count = (fate) => details[part].filter((detail) => detail.fate === fate).length;
      assert.deepEqual(report[part], counts(count('added'), count('moved'), count('unchanged'), count('removed')), `${part}: the details and the counts agree`);
    }
  });
});

describe('planImport of a backup', () => {
  const settings = normalizeSettings({ ...current, theme: 'light', likeShorts: true });
  const like = (videoId, likedAt) => ({ videoId, title: videoId, channelId: COLAS, channelName: 'COLAS', likedAt });
  const history = normalizeHistory([like('aeP4eG-gO10', '2026-11-10T10:00:00.000Z'), like('EkDC9elBHHc', '2026-11-08T10:00:00.000Z')]);

  it('replaces the settings with those of the file, keeps the lists, and counts the settings that change', () => {
    const incoming = settingsWithoutLists(normalizeSettings({ theme: 'dark', likeShorts: false, likeWhat: 'all' }));
    for (const mode of [ImportMode.ADD_NEW, ImportMode.REPLACE]) {
      const result = planImport(settings, { settings: incoming }, mode, NOW);
      assert.equal(result.settings.theme, 'dark', mode);
      assert.equal(result.settings.likeShorts, false);
      assert.equal(result.settings.likeWhat, 'all');
      assert.deepEqual(result.settings.lists, settings.lists, 'the lists are not part of the settings imported');
      assert.deepEqual(result.settings.excludedVideos, settings.excludedVideos);
      assert.deepEqual(result.report.settings, { ...counts(0, 0, 0, 0), changed: 3 });
      assert.equal(importChanges(result.report), true);
    }
  });

  it('gives the lists imported with the settings to the settings saved', () => {
    const incoming = { settings: settingsWithoutLists(normalizeSettings({ theme: 'dark' })), always: normalizeLists({ always: [{ id: WAKED, name: 'Waked XY' }] }).always };
    const result = planImport(settings, incoming, ImportMode.ADD_NEW, NOW);
    assert.deepEqual(ids(result.settings.lists.always), [WAKED, COLAS]);
  });

  it('says nothing changes for settings that are already those of the file', () => {
    const result = planImport(settings, { settings: settingsWithoutLists(settings) }, ImportMode.ADD_NEW, NOW);
    assert.equal(result.report.settings.changed, 0);
    assert.equal(importChanges(result.report), false);
  });

  it('adds the likes of the file to the history, newest first, whatever the mode, and counts them', () => {
    const incoming = normalizeHistory([like('82DBD5efxMc', '2026-11-09T10:00:00.000Z'), like('aeP4eG-gO10', '2026-11-10T10:00:00.000Z')]);
    for (const mode of [ImportMode.ADD_NEW, ImportMode.REPLACE]) {
      const result = planImport(settings, { history: incoming }, mode, NOW, history);
      assert.deepEqual(ids(result.history), ['aeP4eG-gO10', '82DBD5efxMc', 'EkDC9elBHHc'], mode);
      assert.deepEqual(result.report.history, counts(1, 0, 1, 0));
      assert.equal(result.settings, null, 'no settings imported');
    }
  });

  it('keeps the newest MAX_HISTORY likes, and counts only those it keeps', () => {
    const full = normalizeHistory(Array.from({ length: MAX_HISTORY }, (_, n) => like(`v${String(n).padStart(10, '0')}`, new Date(Date.parse(NOW) - n * 1000).toISOString())));
    const incoming = normalizeHistory([like('newerVideo1', '2026-11-10T00:00:00.000Z'), like('olderVideo1', '2020-01-01T00:00:00.000Z')]);
    const result = planImport(settings, { history: incoming }, ImportMode.ADD_NEW, NOW, full);
    assert.equal(result.history.length, MAX_HISTORY);
    assert.equal(result.history[0].videoId, 'newerVideo1');
    assert.equal(result.history.some((entry) => entry.videoId === 'olderVideo1'), false);
    assert.equal(result.report.history.added, 1);
  });

  it('returns the history as it is when the file adds nothing to it', () => {
    const result = planImport(settings, { history: history.slice(0, 1) }, ImportMode.ADD_NEW, NOW, history);
    assert.equal(result.history, history);
    assert.deepEqual(result.report.history, counts(0, 0, 1, 0));
    assert.equal(importChanges(result.report), false);
  });
});
