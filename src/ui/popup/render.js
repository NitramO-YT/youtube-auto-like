/**
 * DOM of the popup, built from the models of view.js. Texts are only ever
 * set with textContent: a channel name from YouTube is never parsed as HTML.
 */
import { createAvatar } from '../shared/avatar.js';
import { Action } from './view.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.4 3.5 2.1-.8 1.3L11 13V7h2z',
  block:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM4 12a8 8 0 0 1 12.9-6.3L5.7 16.9A7.9 7.9 0 0 1 4 12zm8 8a7.9 7.9 0 0 1-4.9-1.7L18.3 7.1A8 8 0 0 1 12 20z',
  alert: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
};
const ACTION_LABELS = {
  [Action.LIKE_NOW]: 'actionLikeNow',
  [Action.SKIP]: 'actionSkip',
  [Action.ALWAYS]: 'actionAlways',
  [Action.NEVER]: 'actionNever',
  [Action.UNLIST_NEVER]: 'actionUnlistNever',
};

function el(doc, tag, className, text) {
  const element = doc.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}

function icon(doc, name) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name] ?? ICONS.clock);
  svg.append(path);
  return svg;
}

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

/** @param {{ text: string, strong: boolean }[]} parts From ruleParts. */
export function renderRule(container, parts) {
  const doc = container.ownerDocument;
  container.replaceChildren(...parts.map((part) => (part.strong ? el(doc, 'strong', null, part.text) : doc.createTextNode(part.text))));
}
