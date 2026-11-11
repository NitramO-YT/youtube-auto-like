import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeLists } from '../../src/core/channels.js';
import { LookupError } from '../../src/ui/options/channel-lookup.js';
import { detailLines, lookupLines, removedCount, reportLines, totalsLine } from '../../src/ui/options/import-report.js';
import { translator } from '../helpers/fake-i18n.mjs';

const fr = translator('fr');
const en = translator('en');
const COLAS = { id: 'UC9orcd4I_3Uy_8_UAz2r48g', name: 'COLAS', avatarUrl: null };
const QOQSIK = { id: 'UCfefITu3BR2ix7ZUSrxj16w', name: 'Qoqsik', avatarUrl: null };
const counts = (added, moved, unchanged, removed) => ({ added, moved, unchanged, removed });

describe('detailLines', () => {
  const video = { videoId: 'aeP4eG-gO10', title: 'Atelier', channelId: COLAS.id, channelName: 'COLAS', channelAvatarUrl: null };

  it('says, for each channel or video, what happens to it and in which list', () => {
    const details = {
      always: [
        { fate: 'added', entry: QOQSIK, from: null },
        { fate: 'moved', entry: COLAS, from: 'never' },
        { fate: 'removed', entry: { id: 'UC1111111111111111111111', name: '' }, from: null },
        { fate: 'unchanged', entry: COLAS, from: 'never' },
        { fate: 'unchanged', entry: QOQSIK, from: null },
      ],
      videos: [{ fate: 'unchanged', entry: video, from: null }],
    };
    assert.deepEqual(
      detailLines(details, fr).map(({ name, parts, removing }) => [name, parts.join(' · '), removing]),
      [
        ['Qoqsik', 'sera ajoutée · Toujours liker', false],
        ['COLAS', 'passera de « Ne jamais liker » à « Toujours liker » · Toujours liker', false],
        ['Chaîne inconnue', 'sera retirée · Toujours liker', true],
        ['COLAS', 'reste dans « Ne jamais liker » · Toujours liker', false],
        ['Qoqsik', 'déjà dans cette liste · Toujours liker', false],
        ['Atelier', 'déjà exclue · Vidéos exclues', false],
      ],
    );
    assert.deepEqual(detailLines({ videos: [{ fate: 'removed', entry: video, from: null }] }, en)[0].avatar, { id: COLAS.id, name: 'COLAS', avatarUrl: null });
  });
});

describe('reportLines and totalsLine', () => {
  const report = { always: counts(3, 1, 0, 0), never: counts(0, 0, 0, 0), videos: counts(1, 0, 2, 1) };

  it('says what changes in each part, with the plural of each count', () => {
    assert.deepEqual(reportLines(report, fr, 'fr'), [
      'Toujours liker : 3 nouvelles · 1 déplacée',
      'Ne jamais liker : rien ne change',
      'Vidéos exclues : 1 nouvelle · 2 déjà présentes · 1 retirée',
    ]);
    assert.equal(reportLines({ always: counts(1, 0, 0, 0) }, en, 'en')[0], 'Always like: 1 new');
  });

  it('sums what changes, all parts together, and counts what goes', () => {
    assert.equal(totalsLine(report, fr, 'fr'), '4 nouvelles · 1 déplacée · 1 retirée');
    assert.equal(totalsLine({ always: counts(0, 0, 4, 0) }, en, 'en'), 'nothing changes');
    assert.equal(removedCount(report), 1);
  });

  it('counts the settings and the likes of a backup in their own words', () => {
    const backup = { ...report, settings: { ...counts(0, 0, 0, 0), changed: 2 }, history: counts(12, 0, 1, 0) };
    assert.deepEqual(reportLines(backup, fr, 'fr').slice(3), [
      'Réglages : 2 réglages changés',
      "Likes posés par l'extension : 12 likes ajoutés · 1 like déjà présent",
    ]);
    assert.equal(totalsLine(backup, fr, 'fr'), '4 nouvelles · 1 déplacée · 1 retirée · 12 likes ajoutés · 2 réglages changés');
    assert.equal(totalsLine({ settings: { ...counts(0, 0, 0, 0), changed: 1 } }, en, 'en'), '1 setting changed');
    assert.equal(totalsLine({ settings: { ...counts(0, 0, 0, 0), changed: 0 }, history: counts(0, 0, 3, 0) }, en, 'en'), 'nothing changes');
  });
});

describe('lookupLines', () => {
  const lists = normalizeLists({ never: [QOQSIK] });

  it('says what happens to each channel in the target list, and why a line names none', () => {
    const lines = lookupLines(
      [
        { line: '@COLAS.', channel: COLAS },
        { line: 'https://youtu.be/aeP4eG-gO10', channel: COLAS },
        { line: '@Qoqsik', channel: QOQSIK },
        { line: 'COLAS', error: LookupError.NOT_A_LINK },
        { line: '@nobody', error: LookupError.NOT_FOUND },
      ],
      lists,
      'always',
      fr,
    );
    assert.deepEqual(
      lines.map(({ text, ok }) => [text, ok]),
      [
        ['sera ajoutée', true],
        ["même chaîne qu'une ligne précédente", true],
        ['passera de « Ne jamais liker » à « Toujours liker »', true],
        ["ni un lien de chaîne ou de vidéo YouTube, ni un @nom", false],
        ['chaîne ou vidéo introuvable sur YouTube', false],
      ],
    );
    assert.equal(lookupLines([{ line: '@Qoqsik', channel: QOQSIK }], lists, 'never', en)[0].text, 'already in this list');
  });
});
