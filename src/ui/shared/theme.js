/**
 * The theme setting on an extension page: data-theme="light" or "dark" on
 * <html> for a fixed theme, no attribute to follow the system (theme.css).
 *
 * The settings are read asynchronously, after the first paint. So that a
 * page opens in its theme instead of switching to it, the theme is also
 * kept in the localStorage of the extension, which ui/boot.js reads
 * synchronously in the <head> of each page. The settings stay the reference:
 * the copy is rewritten each time the page applies them.
 */

export const THEME_KEY = 'theme';
const FIXED_THEMES = ['light', 'dark'];

function setAttribute(doc, theme) {
  if (FIXED_THEMES.includes(theme)) doc.documentElement.setAttribute('data-theme', theme);
  else doc.documentElement.removeAttribute('data-theme');
}

/** Applies the theme of the settings, and keeps a copy for the next opening. */
export function applyTheme(doc, theme, storage) {
  setAttribute(doc, theme);
  try {
    storage.setItem(THEME_KEY, theme);
  } catch {
    // Storage refused (site data blocked): the page works, it only opens in
    // the system theme before switching to the chosen one.
  }
}

/** Applies the copy kept by applyTheme, before the first paint. */
export function bootTheme(doc, storage) {
  try {
    setAttribute(doc, storage.getItem(THEME_KEY));
  } catch {
    // Same as above: without the copy, the page starts in the system theme.
  }
}
