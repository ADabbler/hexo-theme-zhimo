#!/usr/bin/env node
// Builds zhimo theme browser assets from `_app/` sources into `source/`.
//
//   node tools/build.mjs          one-shot build (before hexo generate/deploy)
//   node tools/build.mjs --watch  incremental rebuild for theme development
//
// Outputs are treated as Hexo theme assets. `hexo server` watches
// `source/`, so watch-mode rebuilds trigger regeneration automatically.
import { build, context } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const themeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssOutDir = path.join(themeRoot, 'source', 'css');
const jsOutDir = path.join(themeRoot, 'source', 'js');
const watch = process.argv.includes('--watch');

/** Remove artifacts from earlier builds that the current build did not emit. */
function pruneStaleArtifacts(outDir, freshNames, keepPattern) {
  if (!fs.existsSync(outDir)) return;
  for (const entry of fs.readdirSync(outDir)) {
    if (freshNames.has(entry)) continue;
    if (keepPattern && keepPattern.test(entry)) continue;
    const target = path.join(outDir, entry);
    if (fs.statSync(target).isFile()) fs.unlinkSync(target);
  }
}

function prunePlugin(outDir, keepPattern) {
  return {
    name: 'prune-theme-assets',
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length) return;
        const names = new Set(Object.keys(result.metafile.outputs).map((file) => path.basename(file)));
        pruneStaleArtifacts(outDir, names, keepPattern);
      });
    },
  };
}

function commonOptions() {
  return {
    absWorkingDir: themeRoot,
    bundle: true,
    // Watch builds stay readable with inline sourcemaps; one-shot builds minify.
    minify: !watch,
    logLevel: 'info',
    metafile: true,
    sourcemap: watch ? 'inline' : false,
  };
}

const cssConfig = {
  ...commonOptions(),
  entryPoints: {
    main: '_app/styles/main.css',
    'obsidian-callout': '_app/styles/obsidian-callout.css',
    photoswipe: '_app/styles/photoswipe.css',
  },
  outdir: 'source/css',
  plugins: [prunePlugin(cssOutDir, /^fonts/)],
};

const jsConfig = {
  ...commonOptions(),
  entryPoints: {
    main: '_app/scripts/main.ts',
    search: '_app/scripts/search.ts',
    highlight: '_app/scripts/highlight.ts',
    'obsidian-callout': '_app/scripts/obsidian-callout.ts',
    photoswipe: '_app/scripts/photoswipe.ts',
  },
  outdir: 'source/js',
  format: 'esm',
  splitting: false,
  target: 'es2022',
  plugins: [prunePlugin(jsOutDir)],
};

async function runOnce() {
  await Promise.all([
    build(cssConfig),
    build(jsConfig),
  ]);
  console.log('[zhimo] assets built (one-shot)');
}

async function runWatch() {
  const [cssCtx, jsCtx] = await Promise.all([context(cssConfig), context(jsConfig)]);

  await Promise.all([cssCtx.watch(), jsCtx.watch()]);
  console.log('[zhimo] watching for changes…');

  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    void Promise.all([cssCtx.dispose(), jsCtx.dispose()]).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

async function main() {
  if (watch) {
    await runWatch();
  } else {
    await runOnce();
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exitCode = 1;
});
