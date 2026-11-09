/**
 * User settings: schema, defaults and validation.
 *
 * Settings read from storage are untrusted: written by an older version,
 * edited by hand or imported. normalizeSettings keeps only known keys with
 * valid values and uses the default for anything else, so the rest of the
 * extension never handles a malformed value.
 */
import { normalizeLists } from './channels.js';
import { normalizeExcludedVideos } from './excluded-videos.js';
import { AUTO_LANGUAGE, LANGUAGES } from './locales.js';
import { isValidCheckFrequency } from './update.js';

export const SETTINGS_SCHEMA_VERSION = 1;

// Which channels get liked, before the two lists apply: subscribed channels,
// every channel, or only the channels of the "always like" list.
export const LIKE_WHAT = ['subscribed', 'all', 'alwaysList'];
export const TIMING_MODES = ['instant', 'custom', 'random'];
// Theme of the extension pages: the one of the system, or a fixed one.
export const THEMES = ['system', 'light', 'dark'];
// Rows the lists and the history of the options page show at first, and add
// at each "Show more"; 0 shows them all.
export const LIST_PAGE_SIZES = Object.freeze([10, 20, 50, 100, 0]);
// Order of the rows of the lists of the options page: by date added, newest
// or oldest first, or by name, from A to Z or from Z to A.
export const LIST_SORTS = Object.freeze(['added-desc', 'added-asc', 'name-asc', 'name-desc']);
export const PERCENT_RANGE = Object.freeze({ min: 0, max: 100 });
export const MINUTES_RANGE = Object.freeze({ min: 0, max: 600 });

const DEFAULTS = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  enabled: true,
  likeWhat: 'subscribed',
  likeNormalVideos: true,
  likeShorts: true,
  lists: { always: [], never: [] },
  excludedVideos: [],
  timing: {
    mode: 'instant',
    percent: { enabled: true, value: 50 },
    minutes: { enabled: false, value: 2 },
  },
  updateCheckMinutes: 30,
  // A like the user removes comes back when playback crosses the like time
  // again (off: it stays removed).
  relikeAfterRemoval: false,
  theme: 'system',
  listPageSize: 20,
  // Newest first: the order in which channels and videos are stored.
  listSort: 'added-desc',
  // Keeps the journal of what the extension does (core/journal.js), for the
  // report of a problem; off by default, the journal naming the videos watched
  // and the channels of the lists.
  debug: false,
  // Language of the extension pages: the browser's, or one of core/locales.js.
  language: AUTO_LANGUAGE,
};

export function defaultSettings() {
  return structuredClone(DEFAULTS);
}

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function booleanOr(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function numberInRange(value, { min, max }, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback;
}

export function normalizeSettings(raw) {
  const defaults = defaultSettings();
  const input = objectOrEmpty(raw);
  const timing = objectOrEmpty(input.timing);
  const percent = objectOrEmpty(timing.percent);
  const minutes = objectOrEmpty(timing.minutes);

  const settings = {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    enabled: booleanOr(input.enabled, defaults.enabled),
    likeWhat: oneOf(input.likeWhat, LIKE_WHAT, defaults.likeWhat),
    likeNormalVideos: booleanOr(input.likeNormalVideos, defaults.likeNormalVideos),
    likeShorts: booleanOr(input.likeShorts, defaults.likeShorts),
    lists: normalizeLists(input.lists),
    excludedVideos: normalizeExcludedVideos(input.excludedVideos),
    timing: {
      mode: oneOf(timing.mode, TIMING_MODES, defaults.timing.mode),
      percent: {
        enabled: booleanOr(percent.enabled, defaults.timing.percent.enabled),
        value: numberInRange(percent.value, PERCENT_RANGE, defaults.timing.percent.value),
      },
      minutes: {
        enabled: booleanOr(minutes.enabled, defaults.timing.minutes.enabled),
        value: numberInRange(minutes.value, MINUTES_RANGE, defaults.timing.minutes.value),
      },
    },
    updateCheckMinutes: isValidCheckFrequency(input.updateCheckMinutes) ? input.updateCheckMinutes : defaults.updateCheckMinutes,
    relikeAfterRemoval: booleanOr(input.relikeAfterRemoval, defaults.relikeAfterRemoval),
    theme: oneOf(input.theme, THEMES, defaults.theme),
    listPageSize: oneOf(input.listPageSize, LIST_PAGE_SIZES, defaults.listPageSize),
    listSort: oneOf(input.listSort, LIST_SORTS, defaults.listSort),
    debug: booleanOr(input.debug, defaults.debug),
    language: oneOf(input.language, LANGUAGES, defaults.language),
  };

  // A custom timing with no threshold enabled would leave the user waiting
  // for a like that never comes: the percentage threshold is the fallback.
  const { timing: normalized } = settings;
  if (normalized.mode === 'custom' && !normalized.percent.enabled && !normalized.minutes.enabled) {
    normalized.percent.enabled = true;
  }
  return settings;
}
