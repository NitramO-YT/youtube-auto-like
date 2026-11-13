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
        // Addresses of the page itself (anchors to its sections) and links to
        // other sites (the credits) are not files of the extension.
        const loaded = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((match) => match[1]).filter((address) => !/^https:\/\//.test(address));
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

    it('lets extension pages connect only to their own files, the API that publishes the releases and YouTube', () => {
      const connect = manifest.content_security_policy.extension_pages
        .split(';')
        .map((directive) => directive.trim().split(/\s+/))
        .find(([name]) => name === 'connect-src');
      // 'self': the messages.json of a language chosen in the settings
      // (ui/shared/locale.js); YouTube: the channel pages and oEmbed that
      // name a pasted channel (core/channel-links.js).
      assert.deepEqual(connect.slice(1), ["'self'", new URL(LATEST_RELEASE_API).origin, YOUTUBE_ORIGIN]);
    });

    it('ships the background script it declares, in the form of its browser', async () => {
      // Chromium runs the background as a service worker, Firefox as
      // background scripts; declaring both has kept Firefox from loading an
      // extension (bug 1860304), hence one form per target.
      const background = manifest.background ?? {};
      const file = target === 'firefox' ? background.scripts?.[0] : background.service_worker;
      assert.ok(file, `the ${target} build declares its background`);
      assert.ok(target === 'firefox' ? !background.service_worker : !background.scripts, 'one form of background only');
      const code = await readFile(path.join(outDir, file), 'utf8');
      // A background script cannot load modules unless declared as one.
      assert.doesNotMatch(code, /^\s*(import|export)\s/m);
      // Evaluated as the browser would: an error at the top level (an
      // unknown identifier, a use of the DOM, which a service worker lacks)
      // keeps the whole background from registering, and only shows once
      // loaded. Every browser API is a stub that accepts any call.
      const api = target === 'firefox' ? { browser: stub() } : { chrome: stub() };
      const sandbox = { console: { log() {}, error() {}, warn() {}, debug() {} }, ...api, fetch: stub(), URL, Headers };
      assert.doesNotThrow(() => vm.runInNewContext(code, sandbox, { filename: file }));
    });

    it('carries the identity of its browser only', () => {
      const gecko = manifest.browser_specific_settings?.gecko;
      if (target === 'firefox') {
        assert.match(gecko?.id ?? '', /^[\w.-]+@[\w.-]+$/, 'Firefox needs a fixed add-on ID');
        // data_collection_permissions, which Mozilla requires, exists from
        // Firefox 140; older versions refuse the manifest.
        assert.deepEqual(gecko.data_collection_permissions, { required: ['none'] });
        assert.ok(Number.parseFloat(gecko.strict_min_version) >= 140);
        // No gecko_android: addons.mozilla.org would offer the extension to
        // Firefox for Android, which shows m.youtube.com, a site it does not
        // read. web-ext lint then warns that Firefox for Android knows
        // data_collection_permissions from 142 only, which does not concern
        // the desktop version.
        assert.equal(manifest.browser_specific_settings.gecko_android, undefined);
        assert.equal(manifest.key, undefined, 'the key of the Chromium ID is not for Firefox');
      } else {
        assert.equal(manifest.browser_specific_settings, undefined, 'Chromium warns about Firefox settings');
        assert.ok(manifest.key, 'the key gives the Chromium build its fixed ID');
      }
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
