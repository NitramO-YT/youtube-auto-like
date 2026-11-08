/**
 * Stand-in for the extension API in a preview page (scripts/preview-ui.mjs),
 * loaded before the page's own script. It serves the real texts, and the
 * settings, statistics and video status of one scenario, from
 * window.PREVIEW. Uncaught errors, rejected promises and console.error calls
 * are kept in the data-preview-errors attribute of <html>, which the preview
 * script reads back from the DOM.
 */
(() => {
  const { messages, settings, stats, history, status } = window.PREVIEW;
  const root = document.documentElement;
  const errors = [];
  const record = (text) => {
    errors.push(String(text));
    root.setAttribute('data-preview-errors', JSON.stringify(errors));
  };
  root.setAttribute('data-preview-errors', '[]');
  window.addEventListener('error', (event) => record(event.message));
  window.addEventListener('unhandledrejection', (event) => record(event.reason?.message ?? event.reason));
  const consoleError = console.error.bind(console);
  console.error = (...args) => {
    record(args.map(String).join(' '));
    consoleError(...args);
  };

  // Same resolution as the browser: $NAME$ becomes the content of its
  // placeholder, then $1 to $9 the substitution of that rank.
  function getMessage(key, substitutions = []) {
    const entry = messages[key];
    if (!entry) return '';
    const placeholders = Object.fromEntries(
      Object.entries(entry.placeholders ?? {}).map(([name, placeholder]) => [name.toLowerCase(), placeholder.content]),
    );
    return entry.message
      .replace(/\$(\w+)\$/g, (match, name) => placeholders[name.toLowerCase()] ?? match)
      .replace(/\$([1-9])/g, (_, rank) => substitutions[rank - 1] ?? '');
  }

  const data = { settings, stats, history };
  const listeners = [];

  window.chrome = {
    i18n: { getMessage },
    runtime: {
      id: 'preview',
      getManifest: () => ({ version: window.PREVIEW.version }),
      // root: the extension folder, relative to the preview page.
      getURL: (path) => new URL(window.PREVIEW.root + path, window.location.href).href,
      openOptionsPage: async () => {},
    },
    storage: {
      local: {
        // One key or a list of keys; absent keys are left out of the result.
        async get(keys) {
          const wanted = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(
            wanted.filter((key) => data[key] !== undefined).map((key) => [key, structuredClone(data[key])]),
          );
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
    tabs: {
      async query() {
        return [{ id: 1 }];
      },
      // status "no-answer" stands for a tab without the liker; likedAgoMs
      // becomes likedAt, relative to the moment the page asks.
      async sendMessage() {
        if (status === 'no-answer') throw new Error('Could not establish connection. Receiving end does not exist.');
        const answer = structuredClone(status);
        if (typeof answer.likedAgoMs === 'number') {
          answer.likedAt = Date.now() - answer.likedAgoMs;
          delete answer.likedAgoMs;
        }
        return answer;
      },
    },
  };
})();
