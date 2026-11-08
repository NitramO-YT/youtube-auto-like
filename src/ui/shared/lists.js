/**
 * Changes to the channel lists made from the extension pages, each with the
 * function that undoes it.
 */
import { listOf, placeChannel } from '../../core/channels.js';

/**
 * Moves a channel to a list, or out of both lists with target null. The
 * list it was in is read from the settings as stored, at the moment of the
 * change; the undo puts it back there, with the date it had.
 *
 * @param {object} store From createStore.
 * @param {{ id: string, name?: string|null }} channel
 * @param {'always'|'never'|null} target
 * @returns {Promise<{ settings: object, undo: () => Promise<object> }>}
 * @throws {ListFullError} when the target list is full; nothing is saved.
 */
export async function moveChannel(store, channel, target, now = new Date()) {
  const date = now.toISOString();
  let before = null;
  const settings = await store.updateSettings((current) => {
    const list = listOf(current.lists, channel.id);
    before = { list, entry: list ? current.lists[list].find((existing) => existing.id === channel.id) : null };
    return { ...current, lists: placeChannel(current.lists, channel, target, date) };
  });
  const undo = () =>
    store.updateSettings((current) => ({
      ...current,
      lists: placeChannel(
        current.lists,
        { id: channel.id, name: before.entry?.name || channel.name || '' },
        before.list,
        before.entry?.addedAt ?? date,
      ),
    }));
  return { settings, undo };
}
