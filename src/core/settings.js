/**
 * User settings: schema, defaults and validation.
 *
 * Settings read from storage are untrusted: written by an older version,
 * edited by hand or imported. normalizeSettings keeps only known keys with
 * valid values and uses the default for anything else, so the rest of the
 * extension never handles a malformed value.
 */
import { normalizeLists } from './channels.js';

export const SETTINGS_SCHEMA_VERSION = 1;

// Which channels get liked, before the two lists apply: subscribed channels,
// every channel, or only the channels of the "always like" list.
export const LIKE_WHAT = ['subscribed', 'all', 'alwaysList'];
export const TIMING_MODES = ['instant', 'custom', 'random'];
// Theme of the extension pages: the one of the system, or a fixed one.
export const THEMES = ['system', 'light', 'dark'];
export const PERCENT_RANGE = Object.freeze({ min: 0, max: 100 });
export const MINUTES_RANGE = Object.freeze({ min: 0, max: 600 });

const DEFAULTS = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  enabled: true,
  likeWhat: 'subscribed',
  likeNormalVideos: true,
  likeShorts: true,
  lists: { always: [], never: [] },
  timing: {
    mode: 'instant',
    percent: { enabled: true, value: 50 },
    minutes: { enabled: false, value: 2 },
  },
  notifyUpdates: true,
  theme: 'system',
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
    notifyUpdates: booleanOr(input.notifyUpdates, defaults.notifyUpdates),
    theme: oneOf(input.theme, THEMES, defaults.theme),
  };

  // A custom timing with no threshold enabled would leave the user waiting
  // for a like that never comes: the percentage threshold is the fallback.
  const { timing: normalized } = settings;
  if (normalized.mode === 'custom' && !normalized.percent.enabled && !normalized.minutes.enabled) {
    normalized.percent.enabled = true;
  }
  return settings;
}
