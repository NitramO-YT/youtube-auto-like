/**
 * Minimal stand-ins for DOM elements: just what the YouTube readers call.
 * querySelector and closest answer from maps of exact selectors.
 */
export function element({ attributes = {}, classes = [], children = {}, ancestors = {}, props = {} } = {}) {
  return {
    ...props,
    getAttribute: (name) => (Object.hasOwn(attributes, name) ? attributes[name] : null),
    classList: { contains: (name) => classes.includes(name) },
    querySelector: (selector) => children[selector] ?? null,
    closest: (selector) => ancestors[selector] ?? null,
  };
}

export const fakeDocument = (children = {}) => element({ children });
