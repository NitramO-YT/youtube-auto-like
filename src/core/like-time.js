/**
 * When to like, in seconds of playback, from the timing settings.
 *
 * - instant: at once.
 * - custom: the earliest enabled threshold, a percentage of the duration or a
 *   number of minutes.
 * - random: a whole percentage drawn from 0 to 99, as in
 *   Taknok/youtube-auto-like.
 *
 * A threshold at or past the end moves to END_MARGIN_SECONDS before the end,
 * so that a video shorter than the delay is still liked while it plays
 * (Taknok's rule).
 *
 * A live stream has no meaningful duration: percentages do not apply, a
 * minutes threshold counts from the moment the viewer started watching, and
 * without one the like is immediate.
 */

export const END_MARGIN_SECONDS = 2;

/**
 * @param {object} settings Settings returned by normalizeSettings.
 * @param {object} playback { duration (seconds), isLive (boolean) }.
 * @param {number} random A number in [0, 1); Math.random() outside tests.
 * @returns {{ at: number, basis: string } | null} Seconds of playback (of
 *   watch time, for a live stream) and the rule that set them; null while the
 *   duration of a video that is not live is still unknown.
 */
export function likeTime(settings, playback, random = Math.random()) {
  const { timing } = settings;
  if (timing.mode === 'instant') return { at: 0, basis: 'instant' };

  if (playback.isLive) {
    if (timing.mode === 'custom' && timing.minutes.enabled) {
      return { at: timing.minutes.value * 60, basis: 'minutes' };
    }
    return { at: 0, basis: 'instant' };
  }

  const { duration } = playback;
  if (!(typeof duration === 'number' && Number.isFinite(duration) && duration > 0)) return null;

  const candidates = [];
  if (timing.mode === 'random') {
    candidates.push({ at: (duration * Math.floor(random * 100)) / 100, basis: 'random' });
  } else {
    if (timing.percent.enabled) {
      candidates.push({ at: (duration * timing.percent.value) / 100, basis: 'percent' });
    }
    if (timing.minutes.enabled) {
      candidates.push({ at: timing.minutes.value * 60, basis: 'minutes' });
    }
  }
  if (candidates.length === 0) return { at: 0, basis: 'instant' };

  const earliest = candidates.reduce((best, candidate) => (candidate.at < best.at ? candidate : best));
  if (earliest.at >= duration) {
    return { at: Math.max(0, duration - END_MARGIN_SECONDS), basis: 'before-end' };
  }
  return earliest;
}
