/**
 * New versions, published as GitHub releases of the repository. The latest
 * release comes from the GitHub API (releases/latest, which leaves out
 * drafts and pre-releases); what it says is untrusted until checked here:
 * only a strict version tag and the address of a release of this very
 * repository are kept, since the popup shows that address as a link.
 */

export const REPOSITORY = 'NitramO-YT/youtube-auto-like';
export const LATEST_RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const RELEASE_PAGE_PREFIX = `https://github.com/${REPOSITORY}/releases/`;
const VERSION_PATTERN = /^v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/;
const MAX_URL_LENGTH = 300;

// How often to look for a new version, in minutes; 0 never looks. The
// choices offered first, then any whole number of minutes in the range:
// GitHub allows 60 unauthenticated requests an hour per IP address, so
// checks are 5 minutes apart at least (12 an hour); 30 days at most.
export const UPDATE_CHECK_CHOICES = Object.freeze([0, 30, 60, 360, 1440, 10080]);
export const UPDATE_CHECK_RANGE = Object.freeze({ min: 5, max: 30 * 1440 });

/** Whether minutes is a frequency the checks accept: 0, or a whole number in UPDATE_CHECK_RANGE. */
export function isValidCheckFrequency(minutes) {
  return minutes === 0 || (Number.isInteger(minutes) && minutes >= UPDATE_CHECK_RANGE.min && minutes <= UPDATE_CHECK_RANGE.max);
}

/** [major, minor, patch] of "3.1.0" or "v3.1.0", or null for anything else. */
export function parseVersion(text) {
  const match = typeof text === 'string' ? text.match(VERSION_PATTERN) : null;
  return match ? match.slice(1, 4).map(Number) : null;
}

/** Whether version a is newer than version b; false when either is not a version. */
export function isNewer(a, b) {
  const [left, right] = [parseVersion(a), parseVersion(b)];
  if (!left || !right) return false;
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] > right[i];
  }
  return false;
}

/**
 * The latest release from the JSON of the API: { version ("3.1.0"), url,
 * publishedAt }, or null when the release is not a plain version of this
 * repository.
 */
export function parseLatestRelease(json) {
  if (!json || typeof json !== 'object' || json.draft === true || json.prerelease === true) return null;
  const parts = parseVersion(json.tag_name);
  const url = json.html_url;
  if (!parts || typeof url !== 'string' || url.length > MAX_URL_LENGTH || !url.startsWith(RELEASE_PAGE_PREFIX)) return null;
  const publishedAt = typeof json.published_at === 'string' && !Number.isNaN(Date.parse(json.published_at)) ? json.published_at : null;
  return { version: parts.join('.'), url, publishedAt };
}

/**
 * The state of the update checks, as kept in storage: { latest (from
 * parseLatestRelease, or null when nothing is published), checkedAt (ISO
 * date of the last answer), etag (of that answer), retryAfter (ISO date
 * before which GitHub asked not to come back), failedAt (ISO date of the last
 * failure) }. Anything invalid becomes null.
 */
export function normalizeUpdateState(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const date = (value) => (typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value)) ? value : null);
  return {
    latest: input.latest ? parseLatestRelease({ tag_name: input.latest.version, html_url: input.latest.url, published_at: input.latest.publishedAt }) : null,
    checkedAt: date(input.checkedAt),
    etag: typeof input.etag === 'string' && input.etag.length <= 200 ? input.etag : null,
    retryAfter: date(input.retryAfter),
    failedAt: date(input.failedAt),
  };
}

/** Whether a check is due: never checked, or checked at least `minutes` ago. 0 minutes is never due. */
export function isCheckDue(state, minutes, now) {
  if (!minutes) return false;
  return !state.checkedAt || now - Date.parse(state.checkedAt) >= minutes * 60_000;
}

/** The release to tell the user about: newer than the version installed, or null. */
export function availableUpdate(state, currentVersion) {
  return state.latest && isNewer(state.latest.version, currentVersion) ? state.latest : null;
}

/**
 * Whether the browser installs new versions by itself: the Firefox package
 * names its update manifest (browser_specific_settings.gecko.update_url),
 * which Firefox reads once a day by default; the Chromium packages,
 * installed by hand, have none.
 */
export function updatesItself(manifest) {
  return typeof manifest?.browser_specific_settings?.gecko?.update_url === 'string';
}
