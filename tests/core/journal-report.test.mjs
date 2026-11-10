import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addToJournal, journalEntry, journalText, MAX_JOURNAL, normalizeJournal } from '../../src/core/journal.js';
import { issueUrl, MAX_ISSUE_URL_LENGTH, NEW_ISSUE_URL, reportText } from '../../src/core/report.js';
import { normalizeSettings } from '../../src/core/settings.js';

const AT = Date.parse('2026-11-09T02:10:03.000Z');
const entry = (n, text = 'waiting, at 562 s (percent)') => journalEntry(AT + n * 1000, 'aeP4eG-gO10', text);

describe('journal', () => {
  it('keeps valid entries, the newest last, within MAX_JOURNAL', () => {
    const journal = addToJournal([entry(0)], [entry(1, 'liked'), { at: 'nope', text: 'x' }, { ...entry(2), videoId: 'bad', text: 'y' }]);
    assert.deepEqual(journal.map((e) => [e.text, e.videoId]), [['waiting, at 562 s (percent)', 'aeP4eG-gO10'], ['liked', 'aeP4eG-gO10'], ['y', null]]);
    const full = addToJournal(Array.from({ length: MAX_JOURNAL }, (_, n) => entry(n, `step ${n}`)), [entry(999, 'last')]);
    assert.equal(full.length, MAX_JOURNAL);
    assert.equal(full.at(-1).text, 'last');
    assert.equal(full[0].text, 'step 1');
    assert.deepEqual(normalizeJournal('journal'), []);
    assert.equal(normalizeJournal([{ at: entry(0).at, text: 'x'.repeat(1000) }])[0].text.length, 300);
  });

  it('reads as one line per entry, its time said to be UTC', () => {
    assert.equal(journalText([entry(0), journalEntry(AT, null, 'cut off')]), '2026-11-09 02:10:03 UTC aeP4eG-gO10 waiting, at 562 s (percent)\n2026-11-09 02:10:03 UTC - cut off');
  });
});

describe('report', () => {
  const settings = normalizeSettings({
    timing: { mode: 'custom', percent: { enabled: true, value: 50 }, minutes: { enabled: true, value: 2 } },
    lists: { always: [{ id: 'UC9orcd4I_3Uy_8_UAz2r48g', name: 'COLAS' }] },
  });
  const facts = { version: '3.0.0', userAgent: 'Mozilla/5.0 Chrome/151', settings };

  it('gives the version, the browser and the settings, never the content of the lists', () => {
    const text = reportText({ ...facts, journal: null });
    assert.match(text, /YouTube Auto Like 3\.0\.0/);
    assert.match(text, /Browser: Mozilla\/5\.0 Chrome\/151/);
    assert.match(text, /When: custom \(50 %, 2 min\)/);
    assert.match(text, /Lists: always 1, never 0, excluded videos 0/);
    assert.doesNotMatch(text, /COLAS|UC9orcd4/);
    assert.doesNotMatch(text, /Journal/);
  });

  it('includes the journal only when given, and says when it is empty', () => {
    assert.match(reportText({ ...facts, journal: [entry(0)] }), /### Journal\n```text\n2026-11-09 02:10:03 UTC aeP4eG-gO10 waiting/);
    assert.match(reportText({ ...facts, journal: [] }), /Empty: the debug mode kept nothing\./);
  });

  it('opens a new bug issue holding the report', () => {
    const { url, cut } = issueUrl(reportText({ ...facts, journal: [entry(0)] }));
    assert.equal(cut, false);
    assert.ok(url.startsWith(`${NEW_ISSUE_URL}?labels=bug&body=`));
    assert.match(decodeURIComponent(url.split('&body=')[1]), /aeP4eG-gO10 waiting/);
  });

  it('cuts the oldest entries of a long journal to fit in the address, keeping the newest', () => {
    const journal = Array.from({ length: MAX_JOURNAL }, (_, n) => entry(n, `step ${n} ${'x'.repeat(60)}`));
    const { url, cut } = issueUrl(reportText({ ...facts, journal }));
    assert.equal(cut, true);
    assert.ok(url.length <= MAX_ISSUE_URL_LENGTH);
    const body = decodeURIComponent(url.split('&body=')[1]);
    assert.match(body, /step 199/);
    assert.doesNotMatch(body, /step 0 /);
    assert.match(body, /### Settings/);
    assert.match(body, /Report cut/);
  });

  it('cuts the text itself when there is no journal to shorten', () => {
    const { url, cut } = issueUrl(reportText({ ...facts, userAgent: 'U'.repeat(9000), journal: null }));
    assert.equal(cut, true);
    assert.ok(url.length <= MAX_ISSUE_URL_LENGTH);
    assert.match(decodeURIComponent(url.split('&body=')[1]), /^### What happened/);
  });
});
