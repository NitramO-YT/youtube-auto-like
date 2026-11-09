/**
 * Building blocks for the DOM of the extension pages. Texts are only ever
 * set with textContent: a channel name from YouTube or from an imported file
 * is never parsed as HTML.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
// Paths of 24×24 icons.
const ICONS = {
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.4 3.5 2.1-.8 1.3L11 13V7h2z',
  block:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM4 12a8 8 0 0 1 12.9-6.3L5.7 16.9A7.9 7.9 0 0 1 4 12zm8 8a7.9 7.9 0 0 1-4.9-1.7L18.3 7.1A8 8 0 0 1 12 20z',
  alert: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  close: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',
};

/** An element with an optional class and text. */
export function el(doc, tag, className, text) {
  const element = doc.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}

/**
 * An element whose parts (texts or elements) are joined by " · ", each in a
 * <bdi>: a part takes its direction from its own text, so a Latin channel
 * name next to a date does not reorder the line on an Arabic page.
 */
export function joinedParts(doc, tag, className, parts) {
  const element = el(doc, tag, className);
  parts.forEach((part, index) => {
    if (index > 0) element.append(' · ');
    const isolate = el(doc, 'bdi');
    isolate.append(part);
    element.append(isolate);
  });
  return element;
}

/** A decorative icon (aria-hidden); an unknown name gives the clock. */
export function icon(doc, name) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name] ?? ICONS.clock);
  svg.append(path);
  return svg;
}

/**
 * Allows the animations of the page (data-ready on <html>) from the next
 * frame on, once it shows the stored state.
 */
export function markReady(doc) {
  doc.defaultView.requestAnimationFrame(() => doc.documentElement.setAttribute('data-ready', ''));
}

/**
 * Applies change to the page as a cross-fade where the browser has view
 * transitions (theme.css skips it for reduced motion), at once elsewhere.
 */
export function crossFade(doc, change) {
  if (typeof doc.startViewTransition === 'function') doc.startViewTransition(change);
  else change();
}

/** Fills container with parts from emphasized or ruleParts: strong ones in <strong>. */
export function renderParts(container, parts) {
  const doc = container.ownerDocument;
  container.replaceChildren(...parts.map((part) => (part.strong ? el(doc, 'strong', null, part.text) : doc.createTextNode(part.text))));
}
