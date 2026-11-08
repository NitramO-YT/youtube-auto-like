/**
 * The round picture of a channel: its avatar when the image loads, its
 * initial on a colored disc otherwise (no address, an address refused by
 * avatarUrl, or an image that fails to load).
 */
import { avatarUrl } from '../../core/avatar.js';

// Number of background colors for initials, .avatar-tone-0 to -7 in theme.css.
const TONES = 8;

/** The first letter of the name, in capitals; "?" without a name. */
export function initialOf(name) {
  const [first] = typeof name === 'string' ? name.trim() : '';
  return first ? first.toLocaleUpperCase() : '?';
}

/** A color index that stays the same for a channel, from its ID. */
export function toneOf(id) {
  let hash = 0;
  for (const char of String(id)) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return hash % TONES;
}

/** @param {{ id: string, initial: string, avatarUrl?: string|null }} channel initial from initialOf. */
export function createAvatar(doc, channel) {
  const disc = doc.createElement('span');
  disc.className = `avatar avatar-tone-${toneOf(channel.id)}`;
  disc.setAttribute('aria-hidden', 'true');
  disc.textContent = channel.initial;

  const source = avatarUrl(channel.avatarUrl);
  if (source) {
    const image = doc.createElement('img');
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('load', () => {
      disc.textContent = '';
      disc.append(image);
    });
    // On error, the initial already shown stays.
    image.src = source;
  }
  return disc;
}
