import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeSettings } from '../../src/core/settings.js';
import { ruleParts } from '../../src/ui/shared/rule.js';
import { translator } from '../helpers/fake-i18n.mjs';

const en = translator('en');
const fr = translator('fr');
const NBSP = ' ';
const COLAS = { id: 'UC9orcd4I_3Uy_8_UAz2r48g', name: 'COLAS' };

const sentence = (parts) => parts.map((part) => part.text).join('');
const strong = (parts) => parts.filter((part) => part.strong).map((part) => part.text);
const custom = (percent, minutes) => ({
  timing: { mode: 'custom', percent: { enabled: percent, value: 50 }, minutes: { enabled: minutes, value: 2.5 } },
});

describe('ruleParts', () => {
  it('sums up the default settings, with the settings emphasized', () => {
    const parts = ruleParts(normalizeSettings({}), fr, 'fr');
    assert.equal(sentence(parts), "Like les vidéos et Shorts des chaînes auxquelles vous êtes abonné, dès l'ouverture.");
    assert.deepEqual(strong(parts), ['vidéos et Shorts', 'des chaînes auxquelles vous êtes abonné', "dès l'ouverture"]);
    assert.equal(
      sentence(ruleParts(normalizeSettings({}), en, 'en')),
      'Likes videos and Shorts from the channels you subscribe to, as soon as they open.',
    );
  });

  it('names the channels liked', () => {
    const channels = (settings) => strong(ruleParts(normalizeSettings(settings), en, 'en'))[1];
    assert.equal(channels({ likeWhat: 'all' }), 'from every channel');
    assert.equal(channels({ likeWhat: 'alwaysList' }), 'from the channels in your “Always like” list');
    assert.equal(
      channels({ lists: { always: [COLAS] } }),
      'from the channels you subscribe to and those in your “Always like” list',
    );
  });

  it('names the videos liked, or says that nothing is', () => {
    assert.equal(strong(ruleParts(normalizeSettings({ likeShorts: false }), en, 'en'))[0], 'videos');
    assert.equal(strong(ruleParts(normalizeSettings({ likeNormalVideos: false }), en, 'en'))[0], 'Shorts');
    assert.deepEqual(ruleParts(normalizeSettings({ likeShorts: false, likeNormalVideos: false }), en, 'en'), [
      { text: 'Likes nothing: videos and Shorts are both switched off.', strong: false },
    ]);
  });

  it('says when, with numbers in the language of the texts', () => {
    const when = (settings, t = en, lang = 'en') => strong(ruleParts(normalizeSettings(settings), t, lang))[2];
    assert.equal(when(custom(true, false)), 'at 50% of the video');
    assert.equal(when(custom(false, true), fr, 'fr'), `après 2,5${NBSP}min de lecture`);
    assert.equal(when(custom(true, true)), 'at 50% of the video or after 2.5 min of playback, whichever comes first');
    // normalizeSettings enables the percentage when no threshold is.
    assert.equal(when(custom(false, false)), 'at 50% of the video');
    assert.equal(when({ timing: { mode: 'random' } }), 'at a random moment');
  });
});
