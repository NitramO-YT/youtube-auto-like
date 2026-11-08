/**
 * Numbers, durations and dates as the extension pages show them, in the
 * language of the browser.
 */

/** Playback time as YouTube shows it: 9:22, 1:02:03. */
export function formatClock(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

/** A length of time in words, rounded up to the second: 48 s, 5 min 48 s, 1 h 05 min. */
export function formatDuration(seconds, t) {
  const total = Math.max(0, Math.ceil(seconds));
  if (total < 60) return t('durationSeconds', [total]);
  if (total < 3600) return t('durationMinutes', [Math.floor(total / 60), total % 60]);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  return t('durationHours', [Math.floor(total / 3600), minutes]);
}

export function formatNumber(value, lang) {
  return new Intl.NumberFormat(lang).format(value);
}

/** How long ago, from a delay in milliseconds: "12 seconds ago", "il y a 3 minutes". */
export function formatAgo(elapsedMs, lang) {
  const format = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const seconds = Math.max(0, Math.round(elapsedMs / 1000));
  if (seconds < 60) return format.format(-seconds, 'second');
  if (seconds < 3600) return format.format(-Math.floor(seconds / 60), 'minute');
  if (seconds < 86400) return format.format(-Math.floor(seconds / 3600), 'hour');
  return format.format(-Math.floor(seconds / 86400), 'day');
}

/** "1 248 vidéos likées", with the plural rules of the language. */
export function formatLikeCount(count, lang, t) {
  const key = new Intl.PluralRules(lang).select(count) === 'one' ? 'likeCountOne' : 'likeCountOther';
  return t(key, [formatNumber(count, lang)]);
}
