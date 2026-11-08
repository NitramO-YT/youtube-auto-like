/**
 * DOM of the popup, built from the models of view.js.
 */
import { createAvatar } from '../shared/avatar.js';
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
  [Action.ALWAYS]: 'actionAlways',
  [Action.NEVER]: 'actionNever',
  [Action.UNLIST_NEVER]: 'actionUnlistNever',
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
