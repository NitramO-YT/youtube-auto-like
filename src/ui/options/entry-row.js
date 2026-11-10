/**
 * One line of the reports of the add and import dialogs: the picture and
 * the name of a channel or a video, then what happens to it.
 */
import { createAvatar, initialOf } from '../shared/avatar.js';
import { el, joinedParts } from '../shared/dom.js';

/**
 * @param {Document} doc
 * @param {{ name: string, avatar?: { id: string, name?: string, avatarUrl?: string|null } | null,
 *   parts: Array<string|Node>, failed?: boolean, removing?: boolean }} line
 *   failed for a line that names nothing found, removing for an entry taken out.
 */
export function entryRow(doc, { name, avatar = null, parts, failed = false, removing = false }) {
  const item = el(doc, 'li', ['lookup-row', failed && 'failed', removing && 'removing'].filter(Boolean).join(' '));
  const title = el(doc, 'div', 'title');
  title.append(el(doc, 'span', 'name', name), joinedParts(doc, 'span', 'meta', parts.filter(Boolean)));
  if (avatar) item.append(createAvatar(doc, { id: avatar.id, initial: initialOf(avatar.name), avatarUrl: avatar.avatarUrl }));
  item.append(title);
  return item;
}
