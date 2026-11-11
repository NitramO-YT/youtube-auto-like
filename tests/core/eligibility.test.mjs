import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateEligibility, Reason } from '../../src/core/eligibility.js';
import { normalizeSettings } from '../../src/core/settings.js';

const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const QOQSIK = 'UCfefITu3BR2ix7ZUSrxj16w';

const VIDEO_ID = 'aeP4eG-gO10';

const video = (overrides = {}) => ({
  videoId: VIDEO_ID,
  channelId: COLAS,
  isShort: false,
  subscribed: true,
  liked: false,
  disliked: false,
  ...overrides,
});

const entry = (id) => ({ id, name: '', addedAt: null });
const lists = ({ always = [], never = [] } = {}) => ({ always: always.map(entry), never: never.map(entry) });

const check = (videoOverrides, settingsOverrides) =>
  evaluateEligibility(video(videoOverrides), normalizeSettings({ ...settingsOverrides }));

describe('evaluateEligibility', () => {
  it('likes a fresh video of a subscribed channel with the default settings', () => {
    assert.deepEqual(check(), { eligible: true, reason: Reason.ELIGIBLE });
  });

  it('does nothing when the extension is disabled, whatever the video', () => {
    assert.deepEqual(check({ liked: null }, { enabled: false }), { eligible: false, reason: Reason.DISABLED });
    assert.equal(check({ signedIn: false }, { enabled: false }).reason, Reason.DISABLED);
  });

  it('says that no account is signed in when the page says so, before anything else the page shows', () => {
    assert.deepEqual(check({ signedIn: false, liked: null }), { eligible: false, reason: Reason.SIGNED_OUT });
    assert.equal(check({ signedIn: false }, { likeWhat: 'all' }).reason, Reason.SIGNED_OUT);
  });

  it('goes on with the rules when an account is signed in, or when the page does not say', () => {
    assert.equal(check({ signedIn: true }).reason, Reason.ELIGIBLE);
    assert.equal(check({ signedIn: null }).reason, Reason.ELIGIBLE);
    assert.equal(check({ signedIn: undefined }).reason, Reason.ELIGIBLE);
  });

  describe('state that the page did not provide', () => {
    for (const field of ['liked', 'disliked', 'isShort']) {
      it(`refuses when ${field} is unknown`, () => {
        assert.deepEqual(check({ [field]: null }), { eligible: false, reason: Reason.UNKNOWN_STATE });
      });
    }

    it('refuses when the subscription is unknown and matters', () => {
      assert.equal(check({ subscribed: null }).reason, Reason.UNKNOWN_STATE);
    });

    it('ignores an unknown subscription when every channel is liked', () => {
      assert.equal(check({ subscribed: null }, { likeWhat: 'all' }).eligible, true);
    });

    it('ignores an unknown subscription for a channel of the "always" list', () => {
      assert.equal(check({ subscribed: null }, { lists: lists({ always: [COLAS] }) }).eligible, true);
    });

    it('refuses when the channel is unknown and a list or the list-only rule is in use', () => {
      assert.equal(check({ channelId: null }, { lists: lists({ never: [QOQSIK] }) }).reason, Reason.UNKNOWN_STATE);
      assert.equal(check({ channelId: 'not-an-id' }, { likeWhat: 'alwaysList' }).reason, Reason.UNKNOWN_STATE);
      assert.equal(check({ channelId: null }).eligible, true, 'the channel does not matter without lists');
    });
  });

  it('never touches a video already rated, whatever the lists say', () => {
    assert.equal(check({ liked: true }).reason, Reason.ALREADY_LIKED);
    assert.equal(check({ disliked: true }).reason, Reason.ALREADY_DISLIKED);
    assert.equal(check({ disliked: true }, { lists: lists({ always: [COLAS] }) }).reason, Reason.ALREADY_DISLIKED);
  });

  it('never likes a video the user excluded, even from a channel always liked', () => {
    const excludedVideos = [{ videoId: VIDEO_ID }];
    assert.equal(check({}, { excludedVideos }).reason, Reason.VIDEO_EXCLUDED);
    assert.equal(check({}, { excludedVideos, likeWhat: 'all', lists: lists({ always: [COLAS] }) }).reason, Reason.VIDEO_EXCLUDED);
    assert.equal(check({ liked: true }, { excludedVideos }).reason, Reason.ALREADY_LIKED, 'a rating given comes first');
    assert.equal(check({ videoId: 'EkDC9elBHHc' }, { excludedVideos }).eligible, true, 'other videos are not affected');
  });

  it('applies the Shorts and normal video switches before the lists', () => {
    assert.equal(check({ isShort: true }, { likeShorts: false }).reason, Reason.SHORTS_OFF);
    assert.equal(check({ isShort: true }, { likeShorts: false, lists: lists({ always: [COLAS] }) }).reason, Reason.SHORTS_OFF);
    assert.equal(check({ isShort: false }, { likeNormalVideos: false }).reason, Reason.NORMAL_VIDEOS_OFF);
    assert.equal(check({ isShort: true }, { likeNormalVideos: false }).eligible, true);
  });

  // Every base rule, for a channel in neither list, in "always" and in
  // "never", subscribed or not.
  describe('base rule and lists', () => {
    const cases = [
      // likeWhat, list of the channel, subscribed, eligible, reason when not
      ['subscribed', null, true, true],
      ['subscribed', null, false, false, Reason.NOT_SUBSCRIBED],
      ['subscribed', 'always', false, true],
      ['subscribed', 'never', true, false, Reason.IN_NEVER_LIST],
      ['all', null, false, true],
      ['all', 'always', false, true],
      ['all', 'never', true, false, Reason.IN_NEVER_LIST],
      ['alwaysList', null, true, false, Reason.NOT_IN_ALWAYS_LIST],
      ['alwaysList', 'always', false, true],
      ['alwaysList', 'never', true, false, Reason.IN_NEVER_LIST],
    ];
    for (const [likeWhat, listName, subscribed, eligible, reason] of cases) {
      const label = `${likeWhat}, ${listName ?? 'no list'}, ${subscribed ? 'subscribed' : 'not subscribed'}`;
      it(`${label}: ${eligible ? 'like' : reason}`, () => {
        // Another channel in the other list, so that a list is never empty by accident.
        const settingsLists = listName === 'always' ? lists({ always: [COLAS], never: [QOQSIK] })
          : listName === 'never' ? lists({ always: [QOQSIK], never: [COLAS] })
          : lists({ always: [QOQSIK] });
        assert.deepEqual(check({ subscribed }, { likeWhat, lists: settingsLists }), { eligible, reason: eligible ? Reason.ELIGIBLE : reason });
      });
    }
  });
});
