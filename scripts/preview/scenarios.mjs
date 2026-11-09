/**
 * Situations shown by scripts/preview-ui.mjs, one screenshot each per
 * language and theme. A scenario gives the page (path in the build), an
 * optional query added to its address, the window size, and what the
 * stand-in API serves: settings and statistics as stored, and the status the
 * liker of the tab answers ("no-answer" for a tab without the liker).
 * Channel names and IDs are examples.
 */

const COLAS = 'UC9orcd4I_3Uy_8_UAz2r48g';
// Avatar of COLAS, read on its public channel page on 8 November 2026.
const COLAS_AVATAR =
  'https://yt3.googleusercontent.com/3fhLCThebQlwuSDXM9SEapaTSVFB3EuXHCKtDzFhnugoLLb71I05xsU_yi5-qLMoT0Ve4PQQ=s88-c-k-c0x00ffffff-no-rj-mo';
// 600 px: the highest a popup window of the browser gets.
const POPUP = { page: 'ui/popup/popup.html', size: [340, 600] };
const OPTIONS = { page: 'ui/options/options.html', size: [1100, 1700], status: 'no-answer' };

const video = {
  videoId: 'aeP4eG-gO10',
  title: "J'AI CONSTRUIT MON ATELIER DE RÊVE !",
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
// A check made just now, and a release newer than any version of this project.
const CHECKED_AT = new Date().toISOString();
const NEWER_RELEASE = {
  latest: { version: '99.0.0', url: 'https://github.com/NitramO-YT/youtube-auto-like/releases/tag/v99.0.0', publishedAt: null },
  checkedAt: CHECKED_AT,
};
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
    status: {
      ...video,
      // Long enough to be cut to two lines.
      title: "Restauration complète d'un établi de menuisier ancien : démontage, décapage, recollage et finition à l'huile dure",
      channel: channel(true, { id: 'UCaaaaaaaaaaaaaaaaaaaaaa', name: 'Benjamin Workshop' }),
      status: 'waiting',
      target: { at: 562.5, basis: 'percent' },
    },
  },
  {
    name: 'popup-not-subscribed',
    ...POPUP,
    status: { ...video, isShort: true, channel: channel(false, { id: 'UCbbbbbbbbbbbbbbbbbbbbbb', name: 'qoqsik' }), status: 'not-eligible', reason: 'not-subscribed' },
  },
  {
    name: 'popup-skipped-this-time',
    ...POPUP,
    settings: halfway,
    status: { ...video, channel: channel(true), status: 'skipped', reason: 'skipped-by-user', target: { at: 562.5, basis: 'percent' } },
  },
  {
    name: 'popup-like-removed',
    ...POPUP,
    status: { ...video, channel: channel(true), status: 'liked', target: { at: 0, basis: 'instant' }, likedAgoMs: 60_000, rating: { liked: false, disliked: false } },
  },
  {
    name: 'popup-like-coming-back',
    ...POPUP,
    settings: { ...halfway, relikeAfterRemoval: true },
    status: { ...video, channel: channel(true), status: 'not-eligible', reason: 'like-removed', target: { at: 562.5, basis: 'percent' } },
  },
  {
    name: 'popup-video-excluded',
    ...POPUP,
    settings: { excludedVideos: [{ videoId: 'aeP4eG-gO10', title: "J'AI CONSTRUIT MON ATELIER DE RÊVE !", channelName: 'COLAS' }] },
    status: { ...video, channel: channel(true), status: 'not-eligible', reason: 'video-excluded' },
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
  {
    name: 'popup-update-available',
    ...POPUP,
    update: NEWER_RELEASE,
    status: { ...video, channel: channel(true, { avatarUrl: COLAS_AVATAR }), status: 'liked', target: { at: 0, basis: 'instant' }, likedAgoMs: 60_000 },
  },
  { name: 'popup-no-video', ...POPUP, status: { videoId: null } },
  // A channel page, its channel in "always like".
  {
    name: 'popup-channel-page',
    ...POPUP,
    settings: { lists: { always: [{ id: COLAS, name: 'COLAS' }] } },
    status: { videoId: null, channelPage: { id: COLAS, name: 'COLAS', avatarUrl: COLAS_AVATAR } },
  },
  { name: 'popup-no-answer', ...POPUP, status: 'no-answer' },
  // A fixed theme wins over the one of the system, in both color schemes.
  { name: 'popup-theme-light', ...POPUP, settings: { theme: 'light' }, status: { videoId: null } },
  { name: 'options-theme-dark', ...OPTIONS, size: [1100, 900], settings: { theme: 'dark' } },
  { name: 'options-default', ...OPTIONS, update: { latest: null, checkedAt: CHECKED_AT } },
  { name: 'options-update-available', ...OPTIONS, update: NEWER_RELEASE },
  {
    name: 'options-custom-lists',
    ...OPTIONS,
    settings: {
      likeShorts: false,
      timing: { mode: 'custom', percent: { enabled: true, value: 50 }, minutes: { enabled: false, value: 2 } },
      lists: {
        always: [
          { id: 'UCbbbbbbbbbbbbbbbbbbbbbb', name: 'qoqsik', addedAt: '2026-11-08T20:00:00.000Z' },
          { id: 'UCcccccccccccccccccccccc', name: 'Laurent Houtman', addedAt: '2026-11-02T10:00:00.000Z' },
          { id: 'UCdddddddddddddddddddddd', name: 'Élodie Créations', addedAt: null },
        ],
        never: [{ id: COLAS, name: 'COLAS', avatarUrl: COLAS_AVATAR, addedAt: '2026-10-28T10:00:00.000Z' }],
      },
      excludedVideos: [
        {
          videoId: 'EkDC9elBHHc',
          title: 'le moooonstre',
          channelName: 'COLAS',
          channelAvatarUrl: COLAS_AVATAR,
          isShort: true,
          addedAt: '2026-11-08T21:30:00.000Z',
        },
      ],
    },
    // COLAS has its avatar, the other channels their initial.
    history: [
      {
        videoId: 'EkDC9elBHHc',
        title: 'le moooonstre',
        channelId: COLAS,
        channelName: 'COLAS',
        channelAvatarUrl: COLAS_AVATAR,
        isShort: true,
        likedAt: '2026-11-08T21:12:00.000Z',
      },
      {
        videoId: 'aeP4eG-gO10',
        title: "J'AI CONSTRUIT MON ATELIER DE RÊVE !",
        channelId: COLAS,
        channelName: 'COLAS',
        channelAvatarUrl: COLAS_AVATAR,
        isShort: false,
        likedAt: '2026-11-08T20:40:00.000Z',
      },
      { videoId: 'Bw7eq26hMDw', title: '', channelId: null, channelName: '', isShort: false, likedAt: '2026-11-08T18:05:00.000Z' },
    ],
  },
  {
    // Long lists: "Show more" under the lists and the history.
    name: 'options-long-lists',
    ...OPTIONS,
    settings: {
      lists: {
        always: Array.from({ length: 30 }, (_, i) => ({ id: `UC${String(i).padStart(22, '0')}`, name: `Chaîne ${i + 1}`, addedAt: '2026-11-08T20:00:00.000Z' })),
      },
    },
    history: Array.from({ length: 45 }, (_, i) => ({
      videoId: `video${String(i).padStart(6, '0')}`,
      title: `Vidéo ${i + 1}`,
      channelId: COLAS,
      channelName: 'COLAS',
      isShort: i % 3 === 0,
      likedAt: new Date(Date.UTC(2026, 10, 8, 20, 0) - i * 60_000).toISOString(),
    })),
  },
  {
    // The history full (MAX_HISTORY) and a list as long, to judge the pages of 20.
    name: 'options-500',
    ...OPTIONS,
    settings: {
      lists: {
        always: Array.from({ length: 500 }, (_, i) => ({
          id: `UC${String(i).padStart(22, '0')}`,
          name: `Chaîne d'exemple ${i + 1}`,
          addedAt: new Date(Date.UTC(2026, 10, 8) - i * 3_600_000).toISOString(),
        })),
      },
    },
    history: Array.from({ length: 500 }, (_, i) => ({
      videoId: `video${String(i).padStart(6, '0')}`,
      title: `Titre d'une vidéo d'exemple numéro ${i + 1}`,
      channelId: `UC${String(i % 40).padStart(22, '0')}`,
      channelName: `Chaîne d'exemple ${(i % 40) + 1}`,
      isShort: i % 4 === 0,
      likedAt: new Date(Date.UTC(2026, 10, 8, 23, 0) - i * 1_800_000).toISOString(),
    })),
  },
  // The bottom of the page: "More" with the debug mode and its journal, then "About".
  {
    name: 'options-about',
    ...OPTIONS,
    size: [1100, 3000],
    settings: { debug: true },
    journal: [
      { at: '2026-11-09T02:10:01.000Z', videoId: 'aeP4eG-gO10', text: 'opened (watch)' },
      { at: '2026-11-09T02:10:03.000Z', videoId: 'aeP4eG-gO10', text: 'confirming, at 0 s (instant)' },
      { at: '2026-11-09T02:10:04.000Z', videoId: 'aeP4eG-gO10', text: 'liked, at 0 s (instant)' },
    ],
  },
  // A language chosen in the settings wins over the one of the browser.
  { name: 'popup-language-fr', ...POPUP, settings: { language: 'fr' }, status: { videoId: null } },
  { name: 'options-narrow', ...OPTIONS, size: [390, 1600], settings: { enabled: false, timing: { mode: 'random' } } },
  // The options page as the frame of the popup shows it.
  { name: 'options-embedded', ...OPTIONS, query: '?embedded', size: [340, 470], settings: { enabled: false } },
];
