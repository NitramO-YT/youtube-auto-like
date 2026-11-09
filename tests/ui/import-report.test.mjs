import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeLists } from '../../src/core/channels.js';
import { LookupError } from '../../src/ui/options/channel-lookup.js';
import { lookupLines, removedCount, reportLines, totalsLine } from '../../src/ui/options/import-report.js';
import { translator } from '../helpers/fake-i18n.mjs';

const fr = translator('fr');
const en = translator('en');
const COLAS = { id: 'UC9orcd4I_3Uy_8_UAz2r48g', name: 'COLAS', avatarUrl: null };
const QOQSIK = { id: 'UCfefITu3BR2ix7ZUSrxj16w', name: 'Qoqsik', avatarUrl: null };
const counts = (added, moved, unchanged, removed) => ({ added, moved, unchanged, removed });

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
