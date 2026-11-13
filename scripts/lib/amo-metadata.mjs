/**
 * The listing sent to addons.mozilla.org with each version
 * (store/amo-metadata.json, read by web-ext sign --amo-metadata). Mozilla
 * accepts a first listed version only when the add-on has a name, a summary
 * and categories for each application, and the version a license (AMO API
 * v5, "Create" and VersionAddonMetadataValidator in addons-server, read on
 * 13 November 2026). Checked before anything is sent, so that a missing
 * field shows in a dry run rather than after the upload.
 */

const DEFAULT_LOCALE = 'en-US';
// AMO API: letters, numbers, "-", "_" and "~", not all numeric.
const SLUG_PATTERN = /^(?!\d+$)[\p{L}\p{N}_~-]+$/u;

const hasText = (value) => typeof value === 'string' && value.trim() !== '';

/** The problems of a listing, each as a sentence; [] when it can be sent. */
export function listingProblems(metadata) {
  if (!metadata || typeof metadata !== 'object') return ['The listing is not a JSON object.'];
  const problems = [];
  for (const field of ['name', 'summary', 'description']) {
    if (!hasText(metadata[field]?.[DEFAULT_LOCALE])) problems.push(`${field} has no ${DEFAULT_LOCALE} text.`);
  }
  if (typeof metadata.slug !== 'string' || !SLUG_PATTERN.test(metadata.slug)) {
    problems.push('slug must hold letters, numbers, "-", "_" or "~", and not only numbers.');
  }
  const firefox = metadata.categories?.firefox;
  if (!Array.isArray(firefox) || firefox.length === 0 || !firefox.every(hasText)) {
    problems.push('categories.firefox must list at least one category.');
  }
  if (!hasText(metadata.version?.license)) problems.push('version.license is missing.');
  return problems;
}
