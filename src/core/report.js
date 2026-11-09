/**
 * The report of a problem, attached to an issue on GitHub: the version,
 * the browser, the settings (the size of the lists, never their content),
 * and the journal when the user leaves it in. In English, the language of
 * the repository. Pure: the options page gathers what it needs.
 */
import { journalText } from './journal.js';
import { REPOSITORY } from './update.js';

export const REPOSITORY_URL = `https://github.com/${REPOSITORY}`;
export const NEW_ISSUE_URL = `${REPOSITORY_URL}/issues/new`;
// GitHub answers addresses of more than about 8 000 characters with an
// error (not measured for this repository): the report is cut below that,
// and the user is asked to paste the full one, which the page copies.
export const MAX_ISSUE_URL_LENGTH = 7000;
const CUT_NOTE = '\n\n[Report cut to fit in the address: paste the full report copied from the extension.]';

function timingText({ mode, percent, minutes }) {
  if (mode !== 'custom') return mode;
  const thresholds = [];
  if (percent.enabled) thresholds.push(`${percent.value} %`);
  if (minutes.enabled) thresholds.push(`${minutes.value} min`);
  return `custom (${thresholds.join(', ')})`;
}

/**
 * @param {{ version: string, userAgent: string, settings: object, journal: object[]|null }} facts
 *   journal null leaves it out; an empty one says that none was kept.
 * @returns {string} Markdown.
 */
export function reportText({ version, userAgent, settings, journal }) {
  const lines = [
    '### What happened',
    '<!-- What you did, what you expected, and what the extension did instead. -->',
    '',
    '',
    '### Environment',
    `- YouTube Auto Like ${version}`,
    `- Browser: ${userAgent}`,
    '',
    '### Settings',
    `- Enabled: ${settings.enabled ? 'yes' : 'no'}`,
    `- Channels: ${settings.likeWhat}`,
    `- Videos: ${settings.likeNormalVideos ? 'on' : 'off'}, Shorts: ${settings.likeShorts ? 'on' : 'off'}`,
    `- When: ${timingText(settings.timing)}`,
    `- Like again after removal: ${settings.relikeAfterRemoval ? 'on' : 'off'}`,
    `- Lists: always ${settings.lists.always.length}, never ${settings.lists.never.length}, excluded videos ${settings.excludedVideos.length}`,
    `- Debug mode: ${settings.debug ? 'on' : 'off'}`,
  ];
  if (journal) {
    lines.push('', '### Journal');
    lines.push(journal.length ? ['```text', journalText(journal), '```'].join('\n') : 'Empty: the debug mode kept nothing.');
  }
  return `${lines.join('\n')}\n`;
}

/**
 * The address of a new issue holding the report, and whether the report had
 * to be cut to fit in it.
 */
export function issueUrl(text) {
  const address = (body) => `${NEW_ISSUE_URL}?labels=bug&body=${encodeURIComponent(body)}`;
  if (address(text).length <= MAX_ISSUE_URL_LENGTH) return { url: address(text), cut: false };
  // The end of the report (the newest entries of the journal) matters most:
  // what is cut is its middle, from the oldest entries on.
  const lines = text.split('\n');
  const journalAt = lines.indexOf('### Journal');
  let body = text;
  if (journalAt !== -1) {
    // The lines kept before the entries: the heading and the opening fence.
    const head = journalAt + 2;
    for (let start = head; start < lines.length; start += 1) {
      body = [...lines.slice(0, head), ...lines.slice(start)].join('\n') + CUT_NOTE;
      if (address(body).length <= MAX_ISSUE_URL_LENGTH) return { url: address(body), cut: true };
    }
  }
  // Without a journal to shorten, the text itself is cut.
  body = text;
  while (address(body + CUT_NOTE).length > MAX_ISSUE_URL_LENGTH) body = body.slice(0, Math.floor(body.length * 0.9));
  return { url: address(body + CUT_NOTE), cut: true };
}
