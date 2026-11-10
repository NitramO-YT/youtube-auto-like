/**
 * The channel of a video in a row of the options page (history, excluded
 * videos): a link to its page when its ID is known, its name alone
 * otherwise, nothing without a name.
 */
import { LinkKind, channelPageUrl } from '../../core/channel-links.js';
import { el } from '../shared/dom.js';

/**
 * @param {Document} doc
 * @param {{ channelId?: string|null, channelName?: string }} entry
 * @returns {HTMLAnchorElement|string|null} A part for joinedParts.
 */
export function channelPart(doc, { channelId, channelName }) {
  if (!channelName) return null;
  if (!channelId) return channelName;
  const link = el(doc, 'a', 'channel-link', channelName);
  link.href = channelPageUrl({ kind: LinkKind.CHANNEL_ID, channelId });
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}
