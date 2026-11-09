/**
 * The choice of the user for a channel, wherever the extension pages offer
 * it (the popup, the history of the options page): its videos always liked,
 * liked as the settings say, or never liked.
 */
import { listOf } from '../../core/channels.js';

/**
 * Positions of the choice: in "always like", in neither list (the settings
 * decide), or in "never like". The values of the two lists are their names
 * in the settings; AUTO stands for no list.
 */
export const ChannelChoice = Object.freeze({ ALWAYS: 'always', AUTO: 'auto', NEVER: 'never' });
export const CHANNEL_CHOICES = Object.freeze([ChannelChoice.ALWAYS, ChannelChoice.AUTO, ChannelChoice.NEVER]);

/** The position of a channel ({ id }): the list it is in, or AUTO. */
export function channelChoice(channel, settings) {
  return listOf(settings.lists, channel.id) ?? ChannelChoice.AUTO;
}

/** The list a choice puts the channel in, null for AUTO. */
export function listForChoice(choice) {
  return choice === ChannelChoice.AUTO ? null : choice;
}

/** The notice of a move to target (null: out of both lists) from the list the channel was in. */
export function moveNoticeKey(target, from) {
  if (target === 'always') return 'noticeAddedAlways';
  if (target === 'never') return 'noticeAddedNever';
  return from === 'always' ? 'noticeRemovedAlways' : 'noticeRemovedNever';
}
