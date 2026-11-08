/**
 * Builds the extension for one browser target into dist/<target>/.
 *
 * Usage: npm run build [-- --target chromium]
 */
import { build as esbuild } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ENTRY_POINTS, STATIC_PATHS, TARGETS } from './build-config.mjs';
import { assembleManifest } from './lib/manifest.mjs';

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

/**
 * Everything the build reads is passed in, so that tests can build from
 * fixtures into a temporary folder. The output folder is emptied first.
 */
export async function buildExtension({
  target,
  srcDir,
  outDir,
  version,
  targets = TARGETS,
  staticPaths = STATIC_PATHS,
  entryPoints = ENTRY_POINTS,
}) {
  // Checked before anything is written or deleted.
  if (!targets.includes(target)) {
    throw new Error(`Unknown build target "${target}". Known targets: ${targets.join(', ')}.`);
  }
  const manifestDir = path.join(srcDir, 'manifest');
  const manifest = assembleManifest({
    base: await readJson(path.join(manifestDir, 'base.json')),
    overlay: await readJson(path.join(manifestDir, `${target}.json`)),
    version,
  });

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const staticPath of staticPaths) {
    await cp(path.join(srcDir, staticPath), path.join(outDir, staticPath), { recursive: true });
  }

  if (entryPoints.length > 0) {
    await esbuild({
      entryPoints: entryPoints.map((entry) => ({ in: path.join(srcDir, entry.in), out: entry.out })),
      outdir: outDir,
      bundle: true,
      // Content scripts cannot load ES modules, so every bundle is a
      // self-contained script that works in any extension context.
      format: 'iife',
      target: 'es2022',
      charset: 'utf8',
      // Readable output, for review and for debugging in the browser.
      minify: false,
      logLevel: 'warning',
    });
  }

  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function main() {
  const { values } = parseArgs({
    options: { target: { type: 'string', default: 'chromium' } },
  });
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { version } = await readJson(path.join(root, 'package.json'));
  const outDir = path.join(root, 'dist', values.target);

  await buildExtension({ target: values.target, srcDir: path.join(root, 'src'), outDir, version });
  console.log(`Built ${values.target} ${version} into ${path.relative(root, outDir)}/`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
