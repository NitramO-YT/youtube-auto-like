import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { buildExtension } from '../../scripts/build.mjs';

const FIXTURE_SRC = fileURLToPath(new URL('../fixtures/build/src/', import.meta.url));

const fixtureBuild = (outDir, overrides = {}) =>
  buildExtension({
    target: 'chromium',
    srcDir: FIXTURE_SRC,
    outDir,
    version: '3.0.0',
    targets: ['chromium'],
    staticDirs: ['static'],
    entryPoints: [{ in: 'entry/main.js', out: 'main' }],
    ...overrides,
  });

describe('buildExtension', () => {
  let workDir;

  before(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'yal-build-test-'));
  });

  after(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('writes the assembled manifest, the static folders and the bundles', async () => {
    const outDir = path.join(workDir, 'full');
    await fixtureBuild(outDir);

    const manifest = JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8'));
    assert.deepEqual(manifest, {
      manifest_version: 3,
      name: 'Fixture',
      background: { service_worker: 'main.js' },
      version: '3.0.0',
    });
    assert.equal(
      await readFile(path.join(outDir, 'static', 'note.txt'), 'utf8'),
      'Copied unchanged by the build.\n',
    );

    // The bundle must run as a classic script, with its imports inlined.
    const bundle = await readFile(path.join(outDir, 'main.js'), 'utf8');
    assert.doesNotMatch(bundle, /^\s*(import|export)\s/m);
    const context = vm.createContext({});
    vm.runInContext(bundle, context);
    assert.equal(context.fixtureResult, 'hello build');
  });

  it('removes what a previous build left in the output folder', async () => {
    const outDir = path.join(workDir, 'stale');
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'stale.js'), '');
    await fixtureBuild(outDir);
    await assert.rejects(readFile(path.join(outDir, 'stale.js')), { code: 'ENOENT' });
  });

  it('refuses an unknown target without touching the output folder', async () => {
    const outDir = path.join(workDir, 'untouched');
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'keep.txt'), 'kept');
    await assert.rejects(fixtureBuild(outDir, { target: 'safari' }), /Unknown build target "safari"/);
    assert.equal(await readFile(path.join(outDir, 'keep.txt'), 'utf8'), 'kept');
  });
});
