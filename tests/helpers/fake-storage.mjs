/**
 * storage.local and storage.onChanged as Chromium exposes them in Manifest
 * V3, in memory. data holds what is stored, for the assertions.
 */
export function fakeStorageApi(initial = {}) {
  const data = structuredClone(initial);
  const listeners = [];
  return {
    data,
    storage: {
      local: {
        async get(key) {
          return key in data ? { [key]: structuredClone(data[key]) } : {};
        },
        async set(items) {
          const changes = {};
          for (const [key, value] of Object.entries(items)) {
            changes[key] = { oldValue: data[key], newValue: structuredClone(value) };
            data[key] = structuredClone(value);
          }
          for (const listener of listeners) listener(changes, 'local');
        },
      },
      onChanged: { addListener: (listener) => listeners.push(listener) },
    },
  };
}
