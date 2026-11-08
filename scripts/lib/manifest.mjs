/**
 * Assembles the manifest of one browser target from the shared base
 * (src/manifest/base.json) and the target's overlay (src/manifest/<target>.json).
 */

// Chromium accepts one to four dot-separated integers, each from 0 to 65535.
const VERSION_PATTERN = /^\d+(\.\d+){0,3}$/;
const MAX_VERSION_PART = 65535;

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Objects merge key by key, recursively. Any other overlay value, arrays
 * included, replaces the base value: a target that needs a different list
 * states the whole list. Neither input is modified.
 */
export function mergeManifest(base, overlay) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    merged[key] =
      isPlainObject(value) && isPlainObject(base[key])
        ? mergeManifest(base[key], value)
        : structuredClone(value);
  }
  return merged;
}

export function assertValidVersion(version) {
  const valid =
    typeof version === 'string' &&
    VERSION_PATTERN.test(version) &&
    version.split('.').every((part) => Number(part) <= MAX_VERSION_PART);
  if (!valid) {
    throw new Error(
      `Invalid extension version "${version}": expected one to four dot-separated integers from 0 to ${MAX_VERSION_PART}.`,
    );
  }
}

/**
 * The version comes only from package.json, so that the manifest and the
 * package can never disagree.
 */
export function assembleManifest({ base, overlay, version }) {
  for (const [name, source] of [['base', base], ['overlay', overlay]]) {
    if ('version' in source) {
      throw new Error(
        `The ${name} manifest sets "version"; the version comes from package.json only.`,
      );
    }
  }
  assertValidVersion(version);
  return { ...mergeManifest(base, overlay), version };
}
