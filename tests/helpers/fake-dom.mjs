/**
 * Minimal stand-ins for DOM elements: just what the YouTube readers call.
 * querySelector, querySelectorAll and closest answer from maps of exact
 * selectors; `all` maps a selector to the list querySelectorAll returns.
 */
export function element({ attributes = {}, classes = [], children = {}, all = {}, ancestors = {}, props = {} } = {}) {
  return {
    ...props,
    getAttribute: (name) => (Object.hasOwn(attributes, name) ? attributes[name] : null),
    classList: { contains: (name) => classes.includes(name) },
    querySelector: (selector) => children[selector] ?? null,
    querySelectorAll: (selector) => all[selector] ?? [],
    closest: (selector) => ancestors[selector] ?? null,
  };
}

export const fakeDocument = (children = {}) => element({ children });
