import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { channelsWithoutAvatar, setChannelAvatar } from '../../src/core/channel-avatars.js';
import { defaultSettings } from '../../src/core/settings.js';

const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const QOQSIK = 'UCfefITu3BR2ix7ZUSrxj16w';
const WAKED = 'UChQjbzNlo8xD154bJS3yb8A';
const OLD = 'https://yt3.ggpht.com/old=s88-c-k-c0x00ffffff-no-rj';
const NEW = 'https://yt3.ggpht.com/MVUN-H_w-0QKeMUYdDNiS3NA0cvA8mWGPHNzgTdxvplCbszxBKH-4smhoBfc9GBiI0j8Riu7AA=s88-c-k-c0x00ffffff-no-rj';

const channel = (id, avatarUrl = null) => ({ id, name: id, avatarUrl, addedAt: '2026-11-09T10:00:00.000Z' });
const video = (videoId, channelId, channelAvatarUrl = null) => ({
  videoId,
  title: videoId,
  channelId,
  channelName: '',
  channelAvatarUrl,
  isShort: false,
  addedAt: '2026-11-09T10:00:00.000Z',
});
const like = (videoId, channelId, channelAvatarUrl = null) => ({
  videoId,
  title: videoId,
  channelId,
  channelName: '',
  channelAvatarUrl,
  isShort: false,
  likedAt: '2026-11-11T20:00:00.000Z',
  removedAt: null,
});

const settingsWith = ({ always = [], never = [], excludedVideos = [] } = {}) => ({ ...defaultSettings(), lists: { always, never }, excludedVideos });

describe('setChannelAvatar', () => {
  it('sets the avatar in every entry of the channel: lists, excluded videos and history', () => {
    const settings = settingsWith({ always: [channel(COLAS), channel(QOQSIK)], excludedVideos: [video('JgL5gMtA2X4', COLAS)] });
    const history = [like('aeP4eG-gO10', COLAS), like('82DBD5efxMc', QOQSIK), like('EkDC9elBHHc', COLAS, OLD)];
    const result = setChannelAvatar(settings, history, COLAS, NEW);
    assert.equal(result.count, 4);
    assert.deepEqual(
      result.settings.lists.always.map((entry) => entry.avatarUrl),
      [NEW, null],
    );
    assert.equal(result.settings.excludedVideos[0].channelAvatarUrl, NEW);
    assert.deepEqual(
      result.history.map((entry) => entry.channelAvatarUrl),
      [NEW, null, NEW],
    );
  });

  it('finds the channel in the "never" list too', () => {
    const result = setChannelAvatar(settingsWith({ never: [channel(COLAS)] }), [], COLAS, NEW);
    assert.equal(result.settings.lists.never[0].avatarUrl, NEW);
    assert.equal(result.count, 1);
  });

  it('returns each part that does not change as is, so that nothing is written for it', () => {
    const settings = settingsWith({ always: [channel(QOQSIK)] });
    const history = [like('aeP4eG-gO10', COLAS)];
    const result = setChannelAvatar(settings, history, COLAS, NEW);
    assert.equal(result.settings, settings);
    assert.notEqual(result.history, history);

    const onlyLists = setChannelAvatar(settingsWith({ always: [channel(COLAS)] }), history, QOQSIK, NEW);
    assert.equal(onlyLists.count, 0);
    assert.equal(onlyLists.history, history);
  });

  it('changes nothing for an entry that already has that address, and leaves the inputs untouched', () => {
    const settings = settingsWith({ always: [channel(COLAS, NEW)] });
    const history = [like('aeP4eG-gO10', COLAS, NEW)];
    const frozen = structuredClone({ settings, history });
    const result = setChannelAvatar(settings, history, COLAS, NEW);
    assert.equal(result.count, 0);
    assert.equal(result.settings, settings);
    assert.equal(result.history, history);
    assert.deepEqual({ settings, history }, frozen);
  });

  it('refuses an address that is not an avatar of YouTube, and an invalid channel ID', () => {
    const settings = settingsWith({ always: [channel(COLAS)] });
    for (const [channelId, url] of [
      [COLAS, 'https://evil.example/a.png'],
      [COLAS, 'http://yt3.ggpht.com/a'],
      [COLAS, null],
      ['@COLAS.', NEW],
    ]) {
      const result = setChannelAvatar(settings, [], channelId, url);
      assert.equal(result.count, 0, `${channelId} ${url}`);
      assert.equal(result.settings, settings);
    }
  });

  it('never gives an avatar to the entries saved without a channel', () => {
    const settings = settingsWith({ excludedVideos: [video('JgL5gMtA2X4', null)] });
    const history = [like('aeP4eG-gO10', null)];
    for (const channelId of [null, undefined, '']) {
      assert.equal(setChannelAvatar(settings, history, channelId, NEW).count, 0, String(channelId));
    }
  });
});

describe('channelsWithoutAvatar', () => {
  it('lists each channel with an entry without an avatar once, those of the history first', () => {
    const settings = settingsWith({
      always: [channel(QOQSIK), channel(COLAS, NEW)],
      never: [channel(WAKED)],
      excludedVideos: [video('JgL5gMtA2X4', COLAS), video('N2vleOAu1eY', null)],
    });
    const history = [like('aeP4eG-gO10', COLAS, NEW), like('mvner5stHJc', WAKED), like('82DBD5efxMc', QOQSIK), like('_yl5ELcmugI', null)];
    assert.deepEqual(channelsWithoutAvatar(settings, history), [WAKED, QOQSIK, COLAS]);
  });

  it('is empty when every entry has its avatar', () => {
    assert.deepEqual(channelsWithoutAvatar(settingsWith({ always: [channel(COLAS, NEW)] }), [like('aeP4eG-gO10', COLAS, NEW)]), []);
  });
});
