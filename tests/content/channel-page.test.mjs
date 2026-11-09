import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CHANNEL_PAGE, validateChannelPage } from '../../src/content/protocol.js';
import { channelRefFromUrl, readChannelPage } from '../../src/content/youtube/channel-page.js';
import { element } from '../helpers/fake-dom.mjs';

// Shapes observed in Brave on 9 November 2026.
const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
const QOQSIK = 'UCfefITu3BR2ix7ZUSrxj16w';
const COLAS_AVATAR = 'https://yt3.googleusercontent.com/MVUN-H_w-0QKeMUYdDNiS3NA0cvA8mWGPHNzgTdxvplCbszxBKH-4smhoBfc9GBiI0j8=s900-c-k-c0x00ffffff-no-rj';
const SELECTOR = 'ytd-browse[page-subtype="channels"]';

const metadata = (id, title, handle, avatar = null) => ({
  externalId: id,
  title,
  vanityChannelUrl: `http://www.youtube.com/${handle}`,
  channelUrl: `https://www.youtube.com/channel/${id}`,
  avatar: { thumbnails: avatar ? [{ url: avatar, width: 900, height: 900 }] : [] },
});
const browse = (meta, hidden = false) => element({ props: { hidden, data: { metadata: { channelMetadataRenderer: meta } } } });
const page = (...browses) => element({ all: { [SELECTOR]: browses } });

const colas = metadata(COLAS, 'COLAS', '@COLAS.', COLAS_AVATAR);
const qoqsik = metadata(QOQSIK, 'Qoqsik', '@Qoqsik');

describe('channelRefFromUrl', () => {
  it('reads the handle, without case, from a channel page and its tabs', () => {
    assert.deepEqual(channelRefFromUrl('https://www.youtube.com/@COLAS.'), { handle: '@colas.' });
    assert.deepEqual(channelRefFromUrl('https://www.youtube.com/@COLAS./videos?view=0'), { handle: '@colas.' });
    assert.deepEqual(channelRefFromUrl('https://www.youtube.com/@%C3%89lodie'), { handle: '@élodie' });
  });

  it('reads the channel ID from a /channel/ address', () => {
    assert.deepEqual(channelRefFromUrl(`https://www.youtube.com/channel/${COLAS}/featured`), { channelId: COLAS });
  });

  it('gives nothing on other pages', () => {
    for (const href of ['https://www.youtube.com/', 'https://www.youtube.com/watch?v=aeP4eG-gO10', 'https://www.youtube.com/c/COLAS', 'https://www.youtube.com/@%E0%A4%A', 'not a url']) {
      assert.equal(channelRefFromUrl(href), null, href);
    }
  });
});

describe('readChannelPage', () => {
  it('reads the visible channel page that matches the URL', () => {
    const expected = { channelId: COLAS, channelName: 'COLAS', avatarUrl: COLAS_AVATAR };
    assert.deepEqual(readChannelPage(page(browse(colas)), 'https://www.youtube.com/@colas./videos'), expected);
    assert.deepEqual(readChannelPage(page(browse(colas)), `https://www.youtube.com/channel/${COLAS}`), expected);
  });

  it('ignores a hidden channel page left by an internal navigation', () => {
    assert.equal(readChannelPage(page(browse(colas, true)), 'https://www.youtube.com/@COLAS.'), null);
    assert.equal(readChannelPage(page(browse(qoqsik, true), browse(colas)), 'https://www.youtube.com/@COLAS.').channelId, COLAS);
  });

  it('gives nothing while the page still shows the previous channel', () => {
    // From /@Qoqsik to /@COLAS.: the URL changes first.
    assert.equal(readChannelPage(page(browse(qoqsik)), 'https://www.youtube.com/@COLAS.'), null);
    assert.equal(readChannelPage(page(browse(qoqsik)), `https://www.youtube.com/channel/${COLAS}`), null);
  });

  it('gives nothing on another page, without data, or when the page throws', () => {
    assert.equal(readChannelPage(page(browse(colas)), 'https://www.youtube.com/watch?v=aeP4eG-gO10'), null);
    assert.equal(readChannelPage(page(), 'https://www.youtube.com/@COLAS.'), null);
    assert.equal(readChannelPage(page(element({ props: { hidden: false } })), 'https://www.youtube.com/@COLAS.'), null);
    const throwing = { querySelectorAll: () => { throw new Error('rebuilt'); } };
    assert.equal(readChannelPage(throwing, 'https://www.youtube.com/@COLAS.'), null);
  });

  it('gives no avatar when the page has none', () => {
    assert.equal(readChannelPage(page(browse(qoqsik)), 'https://www.youtube.com/@Qoqsik').avatarUrl, null);
  });
});

describe('validateChannelPage', () => {
  it('keeps a valid channel in the shape of the lists', () => {
    assert.equal(CHANNEL_PAGE, 'channel-page');
    assert.deepEqual(validateChannelPage({ channelId: COLAS, channelName: 'COLAS', avatarUrl: COLAS_AVATAR, extra: 1 }), {
      id: COLAS,
      name: 'COLAS',
      avatarUrl: COLAS_AVATAR,
    });
  });

  it('refuses a payload without a valid channel ID, and an avatar from elsewhere', () => {
    for (const payload of [null, 'x', {}, { channelId: 'COLAS' }]) assert.equal(validateChannelPage(payload), null);
    const channel = validateChannelPage({ channelId: COLAS, channelName: 42, avatarUrl: 'https://example.com/a.png' });
    assert.deepEqual(channel, { id: COLAS, name: '', avatarUrl: null });
  });
});
