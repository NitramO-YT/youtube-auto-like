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
  theme: { get: (settings) => settings.theme, set: (settings, value) => ({ ...settings, theme: value }) },
  relikeAfterRemoval: {
    get: (settings) => settings.relikeAfterRemoval,
    set: (settings, value) => ({ ...settings, relikeAfterRemoval: value }),
  },
  updateCheckMinutes: {
    get: (settings) => settings.updateCheckMinutes,
    set: (settings, value) => ({ ...settings, updateCheckMinutes: value }),
  },
});

export const NUMBER_RANGES = Object.freeze({ percentValue: PERCENT_RANGE, minutesValue: MINUTES_RANGE });

// Units of a custom check frequency, in minutes, largest first.
export const FREQUENCY_UNITS = Object.freeze([1440, 60, 1]);

/** A frequency in minutes as a count of the largest unit that divides it: 90 → { count: 90, unit: 1 }, 2880 → { count: 2, unit: 1440 }. */
export function splitMinutes(minutes) {
  const unit = FREQUENCY_UNITS.find((candidate) => minutes % candidate === 0);
  return { count: minutes / unit, unit };
}

/** Minutes from a count typed and a unit chosen, or null when the count is not a whole positive number. */
export function toMinutes(count, unit) {
  return Number.isInteger(count) && count > 0 && FREQUENCY_UNITS.includes(unit) ? count * unit : null;
}

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

/** The entries whose texts, read by fields(entry), contain the query, in their order. */
function filterBy(entries, query, fields) {
  const wanted = searchable(query.trim());
  if (!wanted) return entries;
  return entries.filter((entry) => fields(entry).some((text) => searchable(text).includes(wanted)));
}

/** The channels whose name or ID contains the query, in their order. */
export function filterChannels(channels, query) {
  return filterBy(channels, query, (channel) => [channel.name, channel.id]);
}

/** The videos whose title, channel name or ID contains the query, in their order. */
export function filterVideos(videos, query) {
  return filterBy(videos, query, (video) => [video.title, video.channelName, video.videoId]);
}
