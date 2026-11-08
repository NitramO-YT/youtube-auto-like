/**
 * Minimal stand-ins for DOM elements: just what the YouTube readers call.
 * querySelector answers from a map of exact selectors.
 */
export function element({ attributes = {}, classes = [], children = {}, props = {} } = {}) {
  return {
    ...props,
    getAttribute: (name) => (Object.hasOwn(attributes, name) ? attributes[name] : null),
    classList: { contains: (name) => classes.includes(name) },
    querySelector: (selector) => children[selector] ?? null,
  };
}

export const fakeDocument = (children = {}) => element({ children });
