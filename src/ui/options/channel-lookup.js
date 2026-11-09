/**
 * Finds the channels named by lines the user pasted, by asking YouTube (see
 * core/channel-links.js for what is accepted and what YouTube answers).
 *
 * Requests carry the YouTube cookies of the browser (credentials:
 * 'include'), as a visit of the page would. Without them, a request from a
 * browser in the European Union is redirected to consent.youtube.com,
 * which the content security policy blocks (Chromium 157, 9 November 2026):
 * the cookie of the consent choice, made once on YouTube, lets the page
 * through. Each request gives up after LOOKUP_TIMEOUT_MS. Lines are looked
 * up one after the other, so that a long paste never sends a burst of
 * requests.
 */
import {
  channelFromPage,
  channelInputFromOembed,
  channelPageUrl,
  LinkKind,
  MAX_LINKS,
  oembedUrl,
  parseChannelInput,
} from '../../core/channel-links.js';

const LOOKUP_TIMEOUT_MS = 15_000;

export const LookupError = Object.freeze({
  // Not an address or a handle of a channel or a video.
  NOT_A_LINK: 'not-a-link',
  // YouTube knows no such channel or video.
  NOT_FOUND: 'not-found',
  // No answer, or an answer that names no channel: YouTube unreachable, or
  // asking for the consent choice first (see above).
  UNREADABLE: 'unreadable',
});

async function ask(fetchImpl, url) {
  return fetchImpl(url, { credentials: 'include', signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
}

/**
 * { channel } or { error } for a CHANNEL_ID or HANDLE input. A channel ID
 * names its channel by itself: only a 404 refuses it, and without a usable
 * answer the channel is kept without its name and avatar. A handle needs
 * the page.
 */
async function lookUpChannelPage(input, fetchImpl) {
  const byId = input.kind === LinkKind.CHANNEL_ID;
  const idOnly = () => (byId ? { channel: { id: input.channelId, name: '', avatarUrl: null } } : { error: LookupError.UNREADABLE });
  let channel = null;
  try {
    const response = await ask(fetchImpl, channelPageUrl(input));
    if (response.status === 404) return { error: LookupError.NOT_FOUND };
    channel = response.ok ? channelFromPage(await response.text()) : null;
  } catch {
    return idOnly();
  }
  // A page that answers for another channel than the one asked is not trusted.
  if (!channel || (byId && channel.id !== input.channelId)) return idOnly();
  return { channel };
}

/** { channel } or { error } for one line. */
export async function lookUpLine(line, fetchImpl) {
  const input = parseChannelInput(line);
  if (!input) return { error: LookupError.NOT_A_LINK };
  if (input.kind !== LinkKind.VIDEO) return lookUpChannelPage(input, fetchImpl);
  let answer;
  try {
    const response = await ask(fetchImpl, oembedUrl(input.videoId));
    // oEmbed answers 400 for an unknown video (9 November 2026); 401, 403
    // and 404, not observed, are taken the same way.
    if ([400, 401, 403, 404].includes(response.status)) return { error: LookupError.NOT_FOUND };
    answer = response.ok ? await response.json() : null;
  } catch {
    return { error: LookupError.UNREADABLE };
  }
  const channelInput = channelInputFromOembed(answer);
  return channelInput ? lookUpChannelPage(channelInput, fetchImpl) : { error: LookupError.UNREADABLE };
}

/**
 * Looks every line up, one after the other.
 *
 * @param {string[]} lines From readLinkLines (core/lists-file.js); at most MAX_LINKS.
 * @param {Function} fetchImpl fetch, or a stand-in in tests.
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<Array<{ line: string, channel?: object, error?: string }>>}
 * @throws {RangeError} for more than MAX_LINKS lines.
 */
export async function lookUpLines(lines, fetchImpl, onProgress = () => {}) {
  if (lines.length > MAX_LINKS) throw new RangeError(`At most ${MAX_LINKS} lines.`);
  const results = [];
  for (const line of lines) {
    results.push({ line, ...(await lookUpLine(line, fetchImpl)) });
    onProgress(results.length, lines.length);
  }
  return results;
}
