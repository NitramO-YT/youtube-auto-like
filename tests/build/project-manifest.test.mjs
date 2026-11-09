import assert from 'node:assert/strict';
import { access, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { TARGETS } from '../../scripts/build-config.mjs';
import { buildExtension } from '../../scripts/build.mjs';
import { AVATAR_HOSTS } from '../../src/core/avatar.js';
import { YOUTUBE_ORIGIN } from '../../src/core/channel-links.js';
import { LATEST_RELEASE_API } from '../../src/core/update.js';

// Builds the real sources of each target and checks what would keep the
// browser from loading the extension.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MESSAGE_PATTERN = /__MSG_(\w+)__/g;

// An object that accepts any property, call or construction, and returns
// another one; `then` stays undefined so that awaiting it resolves at once.
function stub() {
  const proxy = new Proxy(function () {}, {
    get: (_, property) => (property === 'then' ? undefined : property === Symbol.toPrimitive ? () => '' : proxy),
    apply: () => proxy,
    construct: () => proxy,
  });
  return proxy;
}

function collectStrings(value) {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

for (const target of TARGETS) {
  describe(`project build for ${target}`, () => {
    let outDir;
    let manifest;

    before(async () => {
      outDir = await mkdtemp(path.join(tmpdir(), `yal-project-${target}-`));
      const { version } = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
      manifest = await buildExtension({ target, srcDir: path.join(ROOT, 'src'), outDir, version });
    });

    after(async () => {
      await rm(outDir, { recursive: true, force: true });
    });

    it('declares Manifest V3', () => {
      assert.equal(manifest.manifest_version, 3);
    });

    it('ships every icon it declares', async () => {
      for (const icon of Object.values(manifest.icons)) {
        await access(path.join(outDir, icon));
      }
    });

    it('ships every content script it declares', async () => {
      const scripts = (manifest.content_scripts ?? []).flatMap((entry) => entry.js ?? []);
      for (const script of scripts) {
        await access(path.join(outDir, script));
      }
    });

    it('ships the popup, the options page, and every file they load', async () => {
      for (const page of [manifest.action.default_popup, manifest.options_ui.page]) {
        const html = await readFile(path.join(outDir, page), 'utf8');
        // Addresses of the page itself (anchors to its sections) are not files.
        const loaded = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((match) => match[1]);
        assert.ok(loaded.length >= 2, `${page} loads its script and its stylesheet`);
        for (const file of loaded) {
          await access(path.join(outDir, path.dirname(page), file));
        }
      }
    });

    it('lets extension pages load images only from the avatar hosts', () => {
      const directives = Object.fromEntries(
        manifest.content_security_policy.extension_pages
          .split(';')
          .map((directive) => directive.trim().split(/\s+/))
          .map(([name, ...values]) => [name, values]),
      );
      assert.deepEqual(directives['img-src'], ["'self'", ...AVATAR_HOSTS.map((host) => `https://${host}`)]);
      assert.deepEqual(directives['script-src'], ["'self'"]);
      assert.deepEqual(directives['object-src'], ["'none'"]);
    });

    it('lets extension pages connect only to the API that publishes the releases and to YouTube', () => {
      const connect = manifest.content_security_policy.extension_pages
        .split(';')
        .map((directive) => directive.trim().split(/\s+/))
        .find(([name]) => name === 'connect-src');
      // YouTube: the channel pages and oEmbed that name a pasted channel (core/channel-links.js).
      assert.deepEqual(connect.slice(1), [new URL(LATEST_RELEASE_API).origin, YOUTUBE_ORIGIN]);
    });

    it('ships the background service worker it declares', async () => {
      // Chromium runs the background as a service worker; Firefox, later,
      // declares background scripts in its own layer.
      if (target !== 'chromium') return;
      assert.ok(manifest.background?.service_worker, 'the Chromium build declares a service worker');
      const worker = await readFile(path.join(outDir, manifest.background.service_worker), 'utf8');
      // A service worker cannot load modules unless declared as one.
      assert.doesNotMatch(worker, /^\s*(import|export)\s/m);
      // Evaluated as the browser would: an error at the top level (an
      // unknown identifier, a use of the DOM, which a service worker lacks)
      // keeps the whole background from registering, and only shows once
      // loaded. Every browser API is a stub that accepts any call.
      const sandbox = { console: { log() {}, error() {}, warn() {}, debug() {} }, chrome: stub(), fetch: stub(), URL, Headers };
      assert.doesNotThrow(() => vm.runInNewContext(worker, sandbox, { filename: 'background.js' }));
    });

    it('defines every __MSG_ key it uses, in every locale', async () => {
      const keys = new Set(
        collectStrings(manifest).flatMap((text) => [...text.matchAll(MESSAGE_PATTERN)].map((m) => m[1])),
      );
      const locales = await readdir(path.join(outDir, '_locales'));
      assert.ok(locales.includes(manifest.default_locale), 'default_locale has a messages.json');
      for (const locale of locales) {
        const messages = JSON.parse(
          await readFile(path.join(outDir, '_locales', locale, 'messages.json'), 'utf8'),
        );
        for (const key of keys) {
          assert.ok(messages[key]?.message, `${locale} defines ${key}`);
        }
      }
    });
  });
}
