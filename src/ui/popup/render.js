/**
 * DOM of the popup, built from the models of view.js.
 */
import { createAvatar } from '../shared/avatar.js';
import { CHANNEL_CHOICES, ChannelChoice } from '../shared/channel-choice.js';
import { el, icon } from '../shared/dom.js';
import { Action } from './view.js';

const ACTION_LABELS = {
  [Action.LIKE_NOW]: 'actionLikeNow',
  [Action.SKIP]: 'actionSkip',
  [Action.RESUME]: 'actionResume',
  [Action.RESTART]: 'actionRestart',
  [Action.RETRY]: 'actionRetry',
  [Action.EXCLUDE_VIDEO]: 'actionExcludeVideo',
  [Action.UNEXCLUDE_VIDEO]: 'actionUnexcludeVideo',
};

const CHOICE_LABELS = {
  [ChannelChoice.ALWAYS]: 'channelChoiceAlways',
  [ChannelChoice.AUTO]: 'channelChoiceAuto',
  [ChannelChoice.NEVER]: 'channelChoiceNever',
};

/** @param {object|null} channel { id, name, initial, avatarUrl, meta } */
export function renderChannel(container, channel) {
  const doc = container.ownerDocument;
  if (!channel) {
    container.replaceChildren();
    return;
  }
  const row = el(doc, 'div', 'channel');
  const text = el(doc, 'div');
  text.append(el(doc, 'div', 'title', channel.name));
  if (channel.meta) text.append(el(doc, 'div', 'meta', channel.meta));
  row.append(createAvatar(doc, channel), text);
  container.replaceChildren(row);
}

/**
 * "Like this channel's videos": always, as the settings say, or never, as
 * radio inputs named channel-choice whose values are the CHANNEL_CHOICES.
 * On a video made by several channels, a select named choice-channel picks
 * the channel the choice is for.
 *
 * @param {{ choice: string, channels: Array<{ id, name }>|null, selected: string|null }|null} model
 *   choice is the checked position; null draws nothing.
 */
export function renderChannelChoice(container, model, t) {
  const doc = container.ownerDocument;
  if (!model) {
    container.replaceChildren();
    return;
  }
  const { choice, channels, selected } = model;
  const group = el(doc, 'fieldset', 'channel-choice');
  if (channels) {
    const legend = el(doc, 'legend', 'choice-of');
    const label = el(doc, 'label', null, t('channelChoiceOf'));
    const select = el(doc, 'select', 'select');
    select.name = 'choice-channel';
    for (const channel of channels) {
      const option = el(doc, 'option', null, channel.name);
      option.value = channel.id;
      option.selected = channel.id === selected;
      select.append(option);
    }
    label.append(select);
    legend.append(label);
    group.append(legend);
  } else {
    group.append(el(doc, 'legend', null, t('channelChoiceLegend')));
  }
  const options = el(doc, 'div', 'seg');
  for (const value of CHANNEL_CHOICES) {
    const label = el(doc, 'label');
    const input = el(doc, 'input');
    input.type = 'radio';
    input.name = 'channel-choice';
    input.value = value;
    input.checked = value === choice;
    label.append(input, doc.createTextNode(t(CHOICE_LABELS[value])));
    options.append(label);
  }
  group.append(options);
  container.replaceChildren(group);
}

/** @param {object} card { tone, icon, title, detail, progress } */
export function renderCard(container, card) {
  const doc = container.ownerDocument;
  const box = el(doc, 'div', `status tone-${card.tone}`);
  const text = el(doc, 'div', 'text');
  text.append(el(doc, 'strong', null, card.title));
  if (card.detail) text.append(el(doc, 'span', 'detail', card.detail));
  if (card.progress !== null) {
    const bar = el(doc, 'div', 'progress');
    const fill = el(doc, 'span');
    fill.style.width = `${Math.round(card.progress * 1000) / 10}%`;
    bar.append(fill);
    text.append(bar);
  }
  box.append(icon(doc, card.icon), text);
  container.replaceChildren(box);
}

/** One button per action, carrying data-action; "like now" is the primary one. */
export function renderActions(container, actions, t) {
  const doc = container.ownerDocument;
  container.replaceChildren(
    ...actions.map((action) => {
      const button = el(doc, 'button', action === Action.LIKE_NOW ? 'btn primary' : 'btn', t(ACTION_LABELS[action]));
      button.type = 'button';
      button.dataset.action = action;
      return button;
    }),
  );
}
