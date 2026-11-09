/**
 * The channel a channel page shows (/@name or /channel/UC…, and their tabs),
 * for the channel choice of the popup. Paths checked in Brave on
 * 9 November 2026 (see .claude/docs/donnees-youtube.md):
 *
 * - the visible ytd-browse[page-subtype="channels"] holds
 *   data.metadata.channelMetadataRenderer: externalId, title,
 *   vanityChannelUrl (http://www.youtube.com/@name) and avatar.thumbnails;
 * - a hidden one keeps the data of a channel left by an internal
 *   navigation, and ytInitialData describes the document loaded, not the
 *   page shown: neither is read;
 * - after an internal navigation from one channel to another, the URL
 *   changes at once while the visible element keeps the previous channel
 *   for up to half a second. The channel is therefore given only once it
 *   matches the URL.
 *
 * readChannelPage reads properties of YouTube's elements: it runs in the
 * MAIN world. channelRefFromUrl only reads the URL.
 */

const CHANNEL_PAGE = 'ytd-browse[page-subtype="channels"]';

function parse(href) {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}

/** "@name" lowercased and decoded, from the first segment of a path; null otherwise. */
function handleOf(pathname) {
  const [first] = pathname.split('/').filter(Boolean);
  if (!first?.startsWith('@')) return null;
  try {
    return decodeURIComponent(first).toLowerCase();
  } catch {
    return null;
  }
}

/**
 * What a URL says of the channel page it shows: { handle } for /@name…,
 * { channelId } for /channel/UC…, null for any other page. Handles compare
 * without case, as YouTube resolves them.
 */
export function channelRefFromUrl(href) {
  const url = parse(href);
  if (!url) return null;
  const handle = handleOf(url.pathname);
  if (handle) return { handle };
  const channel = url.pathname.match(/^\/channel\/([^/?#]+)/);
  return channel ? { channelId: channel[1] } : null;
}

function matches(ref, metadata) {
  if (ref.channelId) return metadata.externalId === ref.channelId;
  const vanity = typeof metadata.vanityChannelUrl === 'string' ? parse(metadata.vanityChannelUrl) : null;
  return vanity !== null && handleOf(vanity.pathname) === ref.handle;
}

/**
 * { channelId, channelName, avatarUrl } of the channel page shown at href,
 * unchecked (see validateChannelPage in protocol.js); null on any other
 * page, and while the page data does not match the URL yet.
 */
export function readChannelPage(doc, href) {
  const ref = channelRefFromUrl(href);
  if (!ref) return null;
  try {
    const page = [...doc.querySelectorAll(CHANNEL_PAGE)].find((element) => !element.hidden);
    const metadata = page?.data?.metadata?.channelMetadataRenderer;
    if (!metadata || !matches(ref, metadata)) return null;
    const thumbnails = metadata.avatar?.thumbnails;
    return {
      channelId: metadata.externalId,
      channelName: metadata.title,
      avatarUrl: Array.isArray(thumbnails) ? (thumbnails.at(-1)?.url ?? null) : null,
    };
  } catch {
    // A page being rebuilt can throw; the next request sees the new one.
    return null;
  }
}
