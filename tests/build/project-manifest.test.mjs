import assert from 'node:assert/strict';
import { access, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { TARGETS } from '../../scripts/build-config.mjs';
import { buildExtension } from '../../scripts/build.mjs';
import { AVATAR_HOSTS } from '../../src/core/avatar.js';

// Builds the real sources of each target and checks what would keep the
// browser from loading the extension.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MESSAGE_PATTERN = /__MSG_(\w+)__/g;

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

    it('ships the popup and every file it loads', async () => {
      const page = manifest.action.default_popup;
      const html = await readFile(path.join(outDir, page), 'utf8');
      const loaded = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
      assert.ok(loaded.length >= 2, 'the popup loads its script and its stylesheet');
      for (const file of loaded) {
        await access(path.join(outDir, path.dirname(page), file));
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
