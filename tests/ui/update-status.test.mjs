import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeSettings } from '../../src/core/settings.js';
import { normalizeUpdateState } from '../../src/core/update.js';
import { updateStatus } from '../../src/ui/options/update-status.js';
import { translator } from '../helpers/fake-i18n.mjs';

const fr = translator('fr');
const NOW = Date.parse('2026-11-08T22:00:00.000Z');
const URL = 'https://github.com/NitramO-YT/youtube-auto-like/releases/tag/v3.1.0';
const on = normalizeSettings({});
const status = (state, settings = on, version = '3.0.0') => updateStatus(normalizeUpdateState(state), settings, version, fr, 'fr', NOW);

describe('updateStatus', () => {
  it('links to a version newer than the one installed', () => {
    assert.deepEqual(status({ latest: { version: '3.1.0', url: URL }, checkedAt: '2026-11-08T21:55:00.000Z' }), {
      text: 'La version 3.1.0 est disponible ↗',
      url: URL,
      error: false,
    });
  });

  it('says when it last checked, up to date or with nothing published', () => {
    assert.equal(
      status({ latest: { version: '3.0.0', url: URL }, checkedAt: '2026-11-08T21:55:00.000Z' }).text,
      'Vérifié il y a 5 minutes : vous avez la dernière version.',
    );
    assert.equal(status({ checkedAt: '2026-11-08T21:55:00.000Z' }).text, 'Vérifié il y a 5 minutes : aucune version publiée pour l\'instant.');
  });

  it('reports a failure newer than the last answer, and a check never made', () => {
    const failed = status({ checkedAt: '2026-11-08T20:00:00.000Z', failedAt: '2026-11-08T21:00:00.000Z' });
    assert.equal(failed.error, true);
    assert.equal(failed.text, 'La dernière vérification a échoué il y a 1 heure ; la suivante réessaiera.');
    assert.equal(status({ checkedAt: '2026-11-08T21:30:00.000Z', failedAt: '2026-11-08T21:00:00.000Z' }).error, false);
    assert.equal(status({}).text, 'Pas encore vérifié.');
  });

  it('says that new versions are not looked for when checks are off, whatever is known', () => {
    const off = normalizeSettings({ updateCheckMinutes: 0 });
    assert.equal(status({ latest: { version: '3.1.0', url: URL } }, off).text, 'Les nouvelles versions ne sont pas recherchées.');
  });
});
