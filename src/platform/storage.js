/**
 * Settings and statistics in storage.local. Everything read goes through
 * normalizeSettings, so a value written by an older version, by hand or by
 * an import never reaches the rest of the extension as is.
 *
 * The API is passed in, so that tests can use a fake one.
 */
import { normalizeSettings } from '../core/settings.js';

export const SETTINGS_KEY = 'settings';
export const STATS_KEY = 'stats';

function validCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function createStore(api) {
  const area = api.storage.local;
  return {
    async loadSettings() {
      const stored = await area.get(SETTINGS_KEY);
      return normalizeSettings(stored[SETTINGS_KEY]);
    },

    async saveSettings(settings) {
      const normalized = normalizeSettings(settings);
      await area.set({ [SETTINGS_KEY]: normalized });
      return normalized;
    },

    /**
     * Applies change to the settings as stored, and saves the result: a page
     * never writes back an old copy over a change made elsewhere since it
     * loaded. change receives normalized settings and returns new ones.
     */
    async updateSettings(change) {
      return this.saveSettings(change(await this.loadSettings()));
    },

    /** Calls listener with the new settings, normalized, after each change. */
    onSettingsChange(listener) {
      api.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && SETTINGS_KEY in changes) {
          listener(normalizeSettings(changes[SETTINGS_KEY].newValue));
        }
      });
    },

    async loadLikeCount() {
      const stored = await area.get(STATS_KEY);
      return validCount(stored[STATS_KEY]?.likeCount);
    },

    /** Calls listener with the new like count after each change. */
    onLikeCountChange(listener) {
      api.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && STATS_KEY in changes) {
          listener(validCount(changes[STATS_KEY].newValue?.likeCount));
        }
      });
    },

    async incrementLikeCount() {
      const likeCount = (await this.loadLikeCount()) + 1;
      await area.set({ [STATS_KEY]: { likeCount } });
      return likeCount;
    },
  };
}
