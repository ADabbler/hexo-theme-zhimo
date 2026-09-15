#!/usr/bin/env node
// Builds self-hosted Noto Serif SC through a verified WASM splitter:
//
//   node tools/sync-serif-sc.mjs
//
// Input:  @fontsource/noto-serif-sc simplified-Chinese woff2 files.
// Output: frequency-ordered woff2 chunks and unicode-range CSS.
//
// The splitter core URL and SHA-256 are fixed below.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fontSplit, StaticWasm } from 'cn-font-split/dist/wasm/index.mjs';

const themeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const fontsourceRoot = path.dirname(require.resolve('@fontsource/noto-serif-sc/package.json'));
const fontsourceFiles = path.join(fontsourceRoot, 'files');

const WEIGHTS = ['400', '600', '700'];
const EXPECTED_CHUNKS = { 400: 87, 600: 88, 700: 88 };
const outRoot = path.join(themeRoot, 'source', 'fonts', 'serif-sc');
const outCss = path.join(themeRoot, 'source', 'css', 'fonts-serif-sc.css');
const splitter = {
  version: '7.6.8',
  url: 'https://github.com/KonghaYao/cn-font-split/releases/download/7.6.8/libffi-wasm32-wasip1.wasm',
  sha256: '05a88dcb9a0b0d1e14daf0f429d9af6e2ac8d94d9e574523a76d3e9f440dccc9',
};

async function loadSplitter() {
  const response = await fetch(splitter.url);
  if (!response.ok) {
    throw new Error(`could not download cn-font-split WASM core ${splitter.version}: HTTP ${response.status}`);
  }

  const wasm = new Uint8Array(await response.arrayBuffer());
  const checksum = createHash('sha256').update(wasm).digest('hex');
  if (checksum !== splitter.sha256) {
    throw new Error(`cn-font-split WASM checksum mismatch: expected ${splitter.sha256}, got ${checksum}`);
  }
  return new StaticWasm(wasm);
}

function outputFor(outputs, name) {
  const output = outputs.find((item) => item.name === name);
  if (!output) throw new Error(`cn-font-split did not emit ${name}`);
  return output;
}

function writeWeight(weight, chunks) {
  const outDir = path.join(outRoot, weight);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const chunk of chunks) {
    const filename = path.basename(chunk.name);
    if (filename !== chunk.name) throw new Error(`unexpected chunk path: ${chunk.name}`);
    fs.writeFileSync(path.join(outDir, filename), chunk.data);
  }
  console.log(`[zhimo] serif-sc ${weight}: ${chunks.length} chunks`);
}

async function splitWeight(wasm, weight) {
  const input = path.join(fontsourceFiles, `noto-serif-sc-chinese-simplified-${weight}-normal.woff2`);
  const outputs = await fontSplit(
    {
      input: fs.readFileSync(input),
      // WASM uses an in-memory filesystem; the path is only a logical output root.
      outDir: '/font',
      css: {
        fontFamily: 'Noto Serif SC',
        fontWeight: weight,
        fontStyle: 'normal',
        fontDisplay: 'swap',
        localFamily: ['Noto Serif SC'],
        commentBase: false,
        commentNameTable: false,
        commentUnicodes: false,
        compress: true,
      },
      testHtml: false,
      reporter: false,
      silent: true,
    },
    wasm.WasiHandle,
  );

  const chunks = outputs.filter((item) => item.name.endsWith('.woff2'));
  if (chunks.length !== EXPECTED_CHUNKS[weight]) {
    throw new Error(`unexpected ${weight} chunk count: expected ${EXPECTED_CHUNKS[weight]}, got ${chunks.length}`);
  }

  const css = Buffer.from(outputFor(outputs, 'result.css').data).toString('utf8');
  return {
    chunks,
    css: css.replaceAll('url("./', `url("../fonts/serif-sc/${weight}/`),
  };
}

async function main() {
  const wasm = await loadSplitter();
  const splitWeights = [];
  for (const weight of WEIGHTS) {
    const splitResult = await splitWeight(wasm, weight);
    splitWeights.push({ weight, ...splitResult });
  }
  for (const { weight, chunks } of splitWeights) writeWeight(weight, chunks);

  fs.copyFileSync(
    path.join(fontsourceRoot, 'LICENSE'),
    path.join(themeRoot, 'source', 'fonts', 'LICENSE.NotoSerifSC.txt'),
  );
  fs.writeFileSync(outCss, splitWeights.map(({ css }) => css.trim()).join('') + '\n');
  console.log(`[zhimo] serif-sc synced with verified WASM core ${splitter.version}`);
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exitCode = 1;
});
