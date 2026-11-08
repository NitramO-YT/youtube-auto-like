/**
 * Helpers of scripts/preview-ui.mjs that do not start a browser.
 */
import { accessSync, constants } from 'node:fs';
import path from 'node:path';

// Attribute of <html> where scripts/preview/fake-api.js keeps the errors of
// the page, as a JSON array of messages.
export const ERRORS_ATTRIBUTE = 'data-preview-errors';

/** The page with the given scripts loaded before its own first script. */
export function injectScripts(html, sources) {
  const index = html.indexOf('<script');
  if (index === -1) throw new Error('The page has no script to run the preview before.');
  const tags = sources.map((source) => `<script src="${source}"></script>\n`).join('');
  return html.slice(0, index) + tags + html.slice(index);
}

function unescapeAttribute(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

/**
 * The errors recorded in a DOM dumped by the browser, or null when the
 * attribute is missing: the stand-in API did not run, so the page was not
 * checked.
 */
export function readErrors(dom) {
  const match = dom.match(new RegExp(`<html[^>]*\\s${ERRORS_ATTRIBUTE}="([^"]*)"`));
  return match ? JSON.parse(unescapeAttribute(match[1])) : null;
}

const isExecutable = (file) => {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/** The first of names found as an executable in the folders of pathEnv, or null. */
export function findExecutable(names, pathEnv, executable = isExecutable) {
  const dirs = (pathEnv ?? '').split(path.delimiter).filter(Boolean);
  for (const name of names) {
    for (const dir of dirs) {
      const file = path.join(dir, name);
      if (executable(file)) return file;
    }
  }
  return null;
}
