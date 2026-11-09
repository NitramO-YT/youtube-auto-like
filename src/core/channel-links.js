/**
 * What a user pastes to name a channel, and what YouTube answers about it.
 * Pure: the requests themselves are made by the options page
 * (ui/options/channel-lookup.js).
 *
 * Accepted, one per line: a channel ID (UC…), a handle (@name), or an
 * address on www.youtube.com, m.youtube.com, youtube.com or youtu.be: a
 * channel (/channel/UC…, /@name, with any tab), a video (/watch?v=…,
 * /shorts/…, /live/…, youtu.be/…). Anything else is refused.
 *
 * Answers checked on 9 November 2026 (with curl, and from the extension
 * with the cookie of a consent choice, see ui/options/channel-lookup.js):
 * - a channel page (/@name or /channel/UC…) holds
 *   <link rel="canonical" href="https://www.youtube.com/channel/UC…">,
 *   og:title (the name) and og:image (the avatar, yt3.googleusercontent.com,
 *   900 pixels); an unknown handle answers 404. The first "channelId" in the
 *   page can be another channel's (a featured one): only these tags are read;
 * - https://www.youtube.com/oembed?format=json&url=<video> answers
 *   author_name and author_url (https://www.youtube.com/@name); an unknown
 *   video answers 400.
 */
import { storedAvatarUrl } from './avatar.js';
import { isValidChannelId, MAX_NAME_LENGTH } from './channels.js';
import { isValidVideoId } from './video.js';

export const YOUTUBE_ORIGIN = 'https://www.youtube.com';
// A paste of more lines is refused rather than sent as as many requests.
export const MAX_LINKS = 200;

const YOUTUBE_HOSTS = ['www.youtube.com', 'm.youtube.com', 'youtube.com'];
// A handle: "@" then letters, digits, dots, hyphens, underscores and
// middle dots, in any script (YouTube's rules allow non-Latin letters).
const HANDLE_PATTERN = /^@[\p{L}\p{N}._·-]{1,100}$/u;

export const LinkKind = Object.freeze({ CHANNEL_ID: 'channel-id', HANDLE: 'handle', VIDEO: 'video' });

function handleOf(segment) {
  let decoded;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return null;
  }
  return HANDLE_PATTERN.test(decoded) ? decoded : null;
}

function parseUrl(text) {
  try {
    return new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
}

/**
 * What a line names: { kind: CHANNEL_ID, channelId }, { kind: HANDLE,
 * handle } or { kind: VIDEO, videoId }; null for anything else.
 */
export function parseChannelInput(line) {
  const text = typeof line === 'string' ? line.trim() : '';
  if (!text || text.length > 2048) return null;
  if (isValidChannelId(text)) return { kind: LinkKind.CHANNEL_ID, channelId: text };
  if (text.startsWith('@')) {
    const handle = handleOf(text);
    return handle ? { kind: LinkKind.HANDLE, handle } : null;
  }
  const url = parseUrl(text);
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) return null;
  const segments = url.pathname.split('/').filter(Boolean);
  if (url.hostname === 'youtu.be') {
    return segments.length === 1 && isValidVideoId(segments[0]) ? { kind: LinkKind.VIDEO, videoId: segments[0] } : null;
  }
  if (!YOUTUBE_HOSTS.includes(url.hostname)) return null;
  const [first, second] = segments;
  if (first === 'channel') return isValidChannelId(second) ? { kind: LinkKind.CHANNEL_ID, channelId: second } : null;
  if (first?.startsWith('@')) {
    const handle = handleOf(first);
    return handle ? { kind: LinkKind.HANDLE, handle } : null;
  }
  if (first === 'watch' && segments.length === 1) {
    const videoId = url.searchParams.get('v');
    return isValidVideoId(videoId) ? { kind: LinkKind.VIDEO, videoId } : null;
  }
  if ((first === 'shorts' || first === 'live') && isValidVideoId(second)) return { kind: LinkKind.VIDEO, videoId: second };
  return null;
}

/** The address of the page of a channel, from a CHANNEL_ID or HANDLE input. */
export function channelPageUrl(input) {
  return input.kind === LinkKind.CHANNEL_ID
    ? `${YOUTUBE_ORIGIN}/channel/${input.channelId}`
    : `${YOUTUBE_ORIGIN}/@${encodeURIComponent(input.handle.slice(1))}`;
}

/** The oEmbed address that names the channel of a video. */
export function oembedUrl(videoId) {
  return `${YOUTUBE_ORIGIN}/oembed?format=json&url=${encodeURIComponent(`${YOUTUBE_ORIGIN}/watch?v=${videoId}`)}`;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, code) => {
    if (code[0] === '#') {
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    }
    return ENTITIES[code.toLowerCase()] ?? entity;
  });
}

/** The content of the first <meta property="name" content="…"> of a page, decoded; null without one. */
function metaContent(html, property) {
  const found = html.match(new RegExp(`<meta property="${property}" content="([^"]*)"`));
  return found ? decodeEntities(found[1]) : null;
}

/**
 * The channel a channel page describes: { id, name, avatarUrl }, or null
 * when its canonical address is not a channel's.
 */
export function channelFromPage(html) {
  if (typeof html !== 'string') return null;
  const canonical = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/([^"/?#]+)"/);
  if (!canonical || !isValidChannelId(canonical[1])) return null;
  return {
    id: canonical[1],
    name: (metaContent(html, 'og:title') ?? '').trim().slice(0, MAX_NAME_LENGTH),
    avatarUrl: storedAvatarUrl(metaContent(html, 'og:image')),
  };
}

/** The channel input (HANDLE or CHANNEL_ID) of the author of an oEmbed answer, or null. */
export function channelInputFromOembed(answer) {
  if (!answer || typeof answer !== 'object' || typeof answer.author_url !== 'string') return null;
  const input = parseChannelInput(answer.author_url);
  return input && input.kind !== LinkKind.VIDEO ? input : null;
}
