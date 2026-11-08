import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateEligibility, Reason } from '../../src/core/eligibility.js';
import { normalizeSettings } from '../../src/core/settings.js';

const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const QOQSIK = 'UCfefITu3BR2ix7ZUSrxj16w';

const video = (overrides = {}) => ({
  channelId: COLAS,
  isShort: false,
  subscribed: true,
  liked: false,
  disliked: false,
  ...overrides,
});

const settings = (overrides = {}) => normalizeSettings({ ...overrides });

const check = (videoOverrides, settingsOverrides) =>
  evaluateEligibility(video(videoOverrides), settings(settingsOverrides));

describe('evaluateEligibility', () => {
  it('likes a fresh video of a subscribed channel with the default settings', () => {
    assert.deepEqual(check(), { eligible: true, reason: Reason.ELIGIBLE });
  });

  it('does nothing when the extension is disabled, whatever the video', () => {
    assert.deepEqual(check({ liked: null }, { enabled: false }), { eligible: false, reason: Reason.DISABLED });
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

    it('ignores an unknown subscription when every video is liked', () => {
      assert.equal(check({ subscribed: null }, { likeWhat: 'all' }).eligible, true);
    });

    it('refuses when the channel is unknown and the list is in use', () => {
      const list = { list: { enabled: true, mode: 'blocklist' } };
      assert.equal(check({ channelId: null }, list).reason, Reason.UNKNOWN_STATE);
      assert.equal(check({ channelId: 'not-an-id' }, list).reason, Reason.UNKNOWN_STATE);
      assert.equal(check({ channelId: null }).eligible, true, 'the channel does not matter without a list');
    });
  });

  it('never touches a video already rated', () => {
    assert.equal(check({ liked: true }).reason, Reason.ALREADY_LIKED);
    assert.equal(check({ disliked: true }).reason, Reason.ALREADY_DISLIKED);
    assert.equal(check({ liked: true }, { likeWhat: 'all' }).eligible, false);
  });

  it('applies the Shorts and normal video switches', () => {
    assert.equal(check({ isShort: true }, { likeShorts: false }).reason, Reason.SHORTS_OFF);
    assert.equal(check({ isShort: true }, { likeNormalVideos: false }).eligible, true);
    assert.equal(check({ isShort: false }, { likeNormalVideos: false }).reason, Reason.NORMAL_VIDEOS_OFF);
    assert.equal(check({ isShort: false }, { likeShorts: false }).eligible, true);
  });

  it('likes only subscribed channels in subscribed mode, every channel in all mode', () => {
    assert.equal(check({ subscribed: false }).reason, Reason.NOT_SUBSCRIBED);
    assert.equal(check({ subscribed: false }, { likeWhat: 'all' }).eligible, true);
  });

  // Every combination of subscription, list mode, combination and presence
  // in the list, against the expected verdict.
  describe('channel list', () => {
    const cases = [
      // likeWhat, mode, combine, subscribed, listed, eligible, reason when not eligible
      ['subscribed', 'allowlist', 'and', true, true, true],
      ['subscribed', 'allowlist', 'and', true, false, false, Reason.NOT_IN_ALLOWLIST],
      ['subscribed', 'allowlist', 'and', false, true, false, Reason.NOT_SUBSCRIBED],
      ['subscribed', 'allowlist', 'or', false, true, true],
      ['subscribed', 'allowlist', 'or', true, false, true],
      ['subscribed', 'allowlist', 'or', false, false, false, Reason.NOT_IN_ALLOWLIST],
      ['subscribed', 'blocklist', 'and', true, false, true],
      ['subscribed', 'blocklist', 'and', true, true, false, Reason.IN_BLOCKLIST],
      ['subscribed', 'blocklist', 'and', false, false, false, Reason.NOT_SUBSCRIBED],
      ['subscribed', 'blocklist', 'or', false, false, true],
      ['subscribed', 'blocklist', 'or', true, true, true],
      ['subscribed', 'blocklist', 'or', false, true, false, Reason.IN_BLOCKLIST],
      ['all', 'allowlist', 'and', false, true, true],
      ['all', 'allowlist', 'and', false, false, false, Reason.NOT_IN_ALLOWLIST],
      ['all', 'blocklist', 'and', false, true, false, Reason.IN_BLOCKLIST],
      ['all', 'blocklist', 'and', false, false, true],
    ];
    for (const [likeWhat, mode, combine, subscribed, listed, eligible, reason] of cases) {
      const label = `${likeWhat}, ${mode} ${combine}, ${subscribed ? 'subscribed' : 'not subscribed'}, ${listed ? 'listed' : 'not listed'}`;
      it(`${label}: ${eligible ? 'like' : reason}`, () => {
        const result = check(
          { subscribed, channelId: COLAS },
          {
            likeWhat,
            list: { enabled: true, mode, combine },
            channels: listed ? [{ id: COLAS, name: 'COLAS' }] : [{ id: QOQSIK, name: 'Qoqsik' }],
          },
        );
        assert.deepEqual(result, { eligible, reason: eligible ? Reason.ELIGIBLE : reason });
      });
    }
  });

  it('ignores the channel list while it is disabled', () => {
    const blocked = { list: { enabled: false, mode: 'blocklist' }, channels: [{ id: COLAS, name: 'COLAS' }] };
    assert.equal(check({}, blocked).eligible, true);
  });
});
