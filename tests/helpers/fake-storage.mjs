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
        // One key or a list of keys; absent keys are left out of the result.
        async get(keys) {
          const wanted = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(wanted.filter((key) => key in data).map((key) => [key, structuredClone(data[key])]));
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
