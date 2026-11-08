/**
 * User settings: schema, defaults and validation.
 *
 * Settings read from storage are untrusted: written by an older version,
 * edited by hand or imported. normalizeSettings keeps only known keys with
 * valid values and uses the default for anything else, so the rest of the
 * extension never handles a malformed value.
 */
import { normalizeChannels } from './channels.js';

export const SETTINGS_SCHEMA_VERSION = 1;

export const LIKE_WHAT = ['subscribed', 'all'];
export const LIST_MODES = ['blocklist', 'allowlist'];
export const LIST_COMBINATIONS = ['and', 'or'];
export const TIMING_MODES = ['instant', 'custom', 'random'];
export const PERCENT_RANGE = Object.freeze({ min: 0, max: 100 });
export const MINUTES_RANGE = Object.freeze({ min: 0, max: 600 });

const DEFAULTS = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  enabled: true,
  likeWhat: 'subscribed',
  likeNormalVideos: true,
  likeShorts: true,
  list: {
    enabled: false,
    mode: 'blocklist',
    // How the list combines with likeWhat: "and" requires both, "or" either.
    combine: 'and',
  },
  channels: [],
  timing: {
    mode: 'instant',
    percent: { enabled: true, value: 50 },
    minutes: { enabled: false, value: 2 },
  },
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
  const list = objectOrEmpty(input.list);
  const timing = objectOrEmpty(input.timing);
  const percent = objectOrEmpty(timing.percent);
  const minutes = objectOrEmpty(timing.minutes);

  const settings = {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    enabled: booleanOr(input.enabled, defaults.enabled),
    likeWhat: oneOf(input.likeWhat, LIKE_WHAT, defaults.likeWhat),
    likeNormalVideos: booleanOr(input.likeNormalVideos, defaults.likeNormalVideos),
    likeShorts: booleanOr(input.likeShorts, defaults.likeShorts),
    list: {
      enabled: booleanOr(list.enabled, defaults.list.enabled),
      mode: oneOf(list.mode, LIST_MODES, defaults.list.mode),
      combine: oneOf(list.combine, LIST_COMBINATIONS, defaults.list.combine),
    },
    channels: normalizeChannels(input.channels),
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
  };

  // A custom timing with no threshold enabled would leave the user waiting
  // for a like that never comes: the percentage threshold is the fallback.
  const { timing: normalized } = settings;
  if (normalized.mode === 'custom' && !normalized.percent.enabled && !normalized.minutes.enabled) {
    normalized.percent.enabled = true;
  }
  return settings;
}
