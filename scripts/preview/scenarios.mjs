/**
 * Situations shown by scripts/preview-ui.mjs, one screenshot each per
 * language and theme. A scenario gives the page (path in the build), the
 * window size, and what the stand-in API serves: settings and statistics as
 * stored, and the status the liker of the tab answers ("no-answer" for a tab
 * without the liker). Channel names and IDs are examples.
 */

const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
// Avatar of COLAS, read on its public channel page on 8 November 2026.
const COLAS_AVATAR =
  'https://yt3.googleusercontent.com/3fhLCThebQlwuSDXM9SEapaTSVFB3EuXHCKtDzFhnugoLLb71I05xsU_yi5-qLMoT0Ve4PQQ=s88-c-k-c0x00ffffff-no-rj-mo';
const POPUP = { page: 'ui/popup/popup.html', size: [340, 560] };

const video = {
  videoId: 'aeP4eG-gO10',
  isShort: false,
  isLive: false,
  reason: null,
  target: null,
  elapsed: 214,
  duration: 1125,
  likedAt: null,
  ifEnabled: null,
};
const channel = (subscribed, overrides = {}) => ({ id: COLAS, name: 'COLAS', avatarUrl: null, subscribed, ...overrides });
const halfway = { timing: { mode: 'custom', percent: { enabled: true, value: 50 }, minutes: { enabled: false, value: 2 } } };

export const SCENARIOS = [
  {
    name: 'popup-liked',
    ...POPUP,
    status: { ...video, channel: channel(true, { avatarUrl: COLAS_AVATAR }), status: 'liked', target: { at: 0, basis: 'instant' }, likedAgoMs: 12_000 },
  },
  {
    name: 'popup-waiting',
    ...POPUP,
    settings: halfway,
    status: { ...video, channel: channel(true, { id: 'UCaaaaaaaaaaaaaaaaaaaaaa', name: 'Benjamin Workshop' }), status: 'waiting', target: { at: 562.5, basis: 'percent' } },
  },
  {
    name: 'popup-not-subscribed',
    ...POPUP,
    status: { ...video, isShort: true, channel: channel(false, { id: 'UCbbbbbbbbbbbbbbbbbbbbbb', name: 'qoqsik' }), status: 'not-eligible', reason: 'not-subscribed' },
  },
  {
    name: 'popup-click-failed',
    ...POPUP,
    status: { ...video, channel: channel(true), status: 'click-failed' },
  },
  {
    name: 'popup-paused',
    ...POPUP,
    settings: { enabled: false },
    status: { ...video, isShort: true, channel: channel(true), status: 'not-eligible', reason: 'disabled', ifEnabled: { eligible: true, reason: 'eligible' } },
  },
  { name: 'popup-no-video', ...POPUP, status: { videoId: null } },
  { name: 'popup-no-answer', ...POPUP, status: 'no-answer' },
];
