/**
 * Settings, statistics, history of likes and journal in storage.local.
 * Everything read goes through its normalize function, so a value written
 * by an older version, by hand or by an import never reaches the rest of the
 * extension as is.
 *
 * The API is passed in, so that tests can use a fake one.
 */
import { addToHistory, normalizeHistory } from '../core/history.js';
import { addToJournal, normalizeJournal } from '../core/journal.js';
import { normalizeSettings } from '../core/settings.js';
import { normalizeUpdateState } from '../core/update.js';

export const SETTINGS_KEY = 'settings';
export const STATS_KEY = 'stats';
export const HISTORY_KEY = 'history';
export const UPDATE_KEY = 'update';
export const JOURNAL_KEY = 'journal';

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

    /**
     * Counts a like the extension made and adds it to the history, in one
     * write. Two tabs confirming a like at the very same moment could each
     * write over the other's count and entry: storage.local has no
     * transaction, and the likes themselves are not affected.
     *
     * @param {object} entry { videoId, title, channelId, channelName, isShort, likedAt }
     * @returns {Promise<number>} The new like count.
     */
    async recordLike(entry) {
      const stored = await area.get([STATS_KEY, HISTORY_KEY]);
      const likeCount = validCount(stored[STATS_KEY]?.likeCount) + 1;
      const history = addToHistory(normalizeHistory(stored[HISTORY_KEY]), entry);
      await area.set({ [STATS_KEY]: { likeCount }, [HISTORY_KEY]: history });
      return likeCount;
    },

    async loadHistory() {
      const stored = await area.get(HISTORY_KEY);
      return normalizeHistory(stored[HISTORY_KEY]);
    },

    /** Replaces the history (clearing it, or its undo). */
    async setHistory(history) {
      const normalized = normalizeHistory(history);
      await area.set({ [HISTORY_KEY]: normalized });
      return normalized;
    },

    /** The state of the checks for a new version (see normalizeUpdateState). */
    async loadUpdateState() {
      const stored = await area.get(UPDATE_KEY);
      return normalizeUpdateState(stored[UPDATE_KEY]);
    },

    async saveUpdateState(state) {
      const normalized = normalizeUpdateState(state);
      await area.set({ [UPDATE_KEY]: normalized });
      return normalized;
    },

    /** Calls listener with the new state of the checks, normalized, after each change. */
    onUpdateStateChange(listener) {
      api.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && UPDATE_KEY in changes) {
          listener(normalizeUpdateState(changes[UPDATE_KEY].newValue));
        }
      });
    },

    /** Calls listener with the new history, normalized, after each change. */
    onHistoryChange(listener) {
      api.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && HISTORY_KEY in changes) {
          listener(normalizeHistory(changes[HISTORY_KEY].newValue));
        }
      });
    },

    async loadJournal() {
      const stored = await area.get(JOURNAL_KEY);
      return normalizeJournal(stored[JOURNAL_KEY]);
    },

    /**
     * Adds entries at the end of the journal. Like recordLike, two tabs
     * writing at the very same moment could lose one entry: acceptable for a
     * journal meant to help with a report.
     */
    async appendJournal(entries) {
      if (entries.length === 0) return;
      const stored = await area.get(JOURNAL_KEY);
      await area.set({ [JOURNAL_KEY]: addToJournal(normalizeJournal(stored[JOURNAL_KEY]), entries) });
    },

    /** Replaces the journal (clearing it, or its undo). */
    async setJournal(journal) {
      const normalized = normalizeJournal(journal);
      await area.set({ [JOURNAL_KEY]: normalized });
      return normalized;
    },

    /** Calls listener with the new journal, normalized, after each change. */
    onJournalChange(listener) {
      api.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && JOURNAL_KEY in changes) {
          listener(normalizeJournal(changes[JOURNAL_KEY].newValue));
        }
      });
    },

    /** Sets the like count (reset, or its undo); a value that is not a count gives 0. */
    async setLikeCount(count) {
      const likeCount = validCount(count);
      await area.set({ [STATS_KEY]: { likeCount } });
      return likeCount;
    },
  };
}
