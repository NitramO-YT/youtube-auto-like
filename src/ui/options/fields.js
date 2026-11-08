/**
 * The settings the options page edits, and the rules of its form. Pure, so
 * that each rule is tested without a page.
 */
import { MINUTES_RANGE, PERCENT_RANGE } from '../../core/settings.js';

const timingPart = (part, key) => ({
  get: (settings) => settings.timing[part][key],
  set: (settings, value) => ({ ...settings, timing: { ...settings.timing, [part]: { ...settings.timing[part], [key]: value } } }),
});

/**
 * Each field reads its value from settings (get) and returns new settings
 * holding another value (set). An undo sets back the value read before the
 * change.
 */
export const FIELDS = Object.freeze({
  enabled: { get: (settings) => settings.enabled, set: (settings, value) => ({ ...settings, enabled: value }) },
  likeWhat: { get: (settings) => settings.likeWhat, set: (settings, value) => ({ ...settings, likeWhat: value }) },
  likeNormalVideos: {
    get: (settings) => settings.likeNormalVideos,
    set: (settings, value) => ({ ...settings, likeNormalVideos: value }),
  },
  likeShorts: { get: (settings) => settings.likeShorts, set: (settings, value) => ({ ...settings, likeShorts: value }) },
  timingMode: {
    get: (settings) => settings.timing.mode,
    set: (settings, value) => ({ ...settings, timing: { ...settings.timing, mode: value } }),
  },
  percentEnabled: timingPart('percent', 'enabled'),
  percentValue: timingPart('percent', 'value'),
  minutesEnabled: timingPart('minutes', 'enabled'),
  minutesValue: timingPart('minutes', 'value'),
  lists: { get: (settings) => settings.lists, set: (settings, value) => ({ ...settings, lists: value }) },
});

export const NUMBER_RANGES = Object.freeze({ percentValue: PERCENT_RANGE, minutesValue: MINUTES_RANGE });

/** The number typed in a field, or null when it is empty or out of its range. */
export function validNumber(value, range) {
  return typeof value === 'number' && Number.isFinite(value) && value >= range.min && value <= range.max ? value : null;
}

/**
 * The threshold whose box cannot be unchecked: the only one checked, in
 * custom timing. Unchecking it would leave no threshold, and
 * normalizeSettings would check the percentage again behind the user's back.
 *
 * @returns {'percent'|'minutes'|null}
 */
export function lockedThreshold(timing) {
  if (timing.mode !== 'custom') return null;
  if (timing.percent.enabled && !timing.minutes.enabled) return 'percent';
  if (timing.minutes.enabled && !timing.percent.enabled) return 'minutes';
  return null;
}

// Lower case, without accents: "Élodie" is found by "elodie".
const searchable = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();

/** The channels whose name or ID contains the query, in their order. */
export function filterChannels(channels, query) {
  const wanted = searchable(query.trim());
  if (!wanted) return channels;
  return channels.filter((channel) => searchable(channel.name).includes(wanted) || searchable(channel.id).includes(wanted));
}
