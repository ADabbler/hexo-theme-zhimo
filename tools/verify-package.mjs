// node tools/verify-package.mjs
// Checks that the package contains every runtime file and no development files.

import { execSync } from 'node:child_process';
import process from 'node:process';

const REQUIRED = [
  '_config.yml',
  'LICENSE',
  'README.md',
  'README.zh-CN.md',
  'languages/en.yml',
  'languages/zh-CN.yml',
  'layout/layout.ejs',
  'lib/listings.js',
  'scripts/helpers.js',
  'source/css/main.css',
  'source/js/main.js',
  'source/fonts/GeistSans-Regular.woff2',
  'source/fonts/JetBrainsMonoNL-Regular.woff2',
  'source/fonts/SourceSerif4-Regular.woff2',
  'source/fonts/LICENSE.Geist.txt',
  'source/fonts/LICENSE.JetBrainsMono.txt',
  'source/fonts/LICENSE.NotoSerifSC.txt',
  'source/fonts/LICENSE.SourceSerif4.txt'
];

const REQUIRED_PREFIXES = ['source/fonts/serif-sc/'];

const FORBIDDEN_PREFIXES = ['_app/', 'docs/', 'tools/'];

const output = execSync('npm pack --dry-run --ignore-scripts --json', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit']
});
// npm 11 reports an array of packs, npm 12 an object keyed by package name.
const parsed = JSON.parse(output);
const pack = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0];
if (!pack || !Array.isArray(pack.files)) {
  throw new Error('[zhimo] unexpected npm pack output');
}
const files = pack.files.map(entry => entry.path);

const missingFiles = REQUIRED.filter(path => !files.includes(path));
const missingGroups = REQUIRED_PREFIXES
  .filter(prefix => !files.some(path => path.startsWith(prefix)))
  .map(prefix => `${prefix}*`);
const missing = [...missingFiles, ...missingGroups];
if (missing.length) {
  console.error(`[zhimo] missing from the package: ${missing.join(', ')}`);
  process.exit(1);
}

const forbidden = files.filter(path => FORBIDDEN_PREFIXES.some(prefix => path.startsWith(prefix)));
if (forbidden.length) {
  console.error(`[zhimo] development files must not be published: ${forbidden.join(', ')}`);
  process.exit(1);
}

const compiled = files.filter(path => path.startsWith('source/css/') || path.startsWith('source/js/'));
console.log(`[zhimo] package contents ok: ${files.length} files, ${compiled.length} compiled assets`);
