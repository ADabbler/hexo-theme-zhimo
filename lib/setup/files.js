'use strict';

const fs = require('fs/promises');
const path = require('path');
const { split, escape } = require('hexo-front-matter');
const { deepMerge } = require('hexo-util');
const validateData = require('./data');
const { configuredLanguages, pageLanguageValue, localizedPath, isExternalPath, homePath, directory } = require('../language');

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function exists(file) {
  try {
    await fs.stat(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function displayPath(hexo, file) {
  return path.relative(hexo.base_dir, file).split(path.sep).join('/');
}

async function readObject(hexo, file) {
  const value = await hexo.render.render({ path: file });
  if (!isRecord(value)) throw new Error(`${file}: expected a configuration object.`);
  return value;
}

async function variants(dir, name) {
  if (!await exists(dir)) return [];
  const entries = await fs.readdir(dir);
  return entries.filter(file => path.parse(file).name === name).sort().map(file => path.join(dir, file));
}

function outputRoute(value) {
  if (typeof value !== 'string' || !value || isExternalPath(value) || /[?#\\\u0000-\u001f]/.test(value)) {
    throw new Error(`Invalid local page path: ${JSON.stringify(value)}.`);
  }
  const route = value.replace(/^\/+/, '');
  for (const segment of route.split('/')) {
    const decoded = decodeURIComponent(segment);
    if (decoded === '.' || decoded === '..' || /[/\\]/.test(decoded)) {
      throw new Error(`Invalid local page path: ${JSON.stringify(value)}.`);
    }
  }
  if (!route || route.endsWith('/')) return `${route}index.html`;
  return path.posix.extname(route) ? route : `${route}.html`;
}

function pageTarget(hexo, theme, layout, lang) {
  if (layout === '404') {
    const route = lang === configuredLanguages(hexo)[0] ? '404.html' : `${lang}/404/index.html`;
    return { layout, lang, route, source: `${route.slice(0, -5)}.md` };
  }
  const menu = theme.menu;
  if (!isRecord(menu)) throw new Error('menu must be a configuration object.');
  const configured = menu[`menu.${layout}`];
  const value = configured === undefined ? `/${layout}/` : configured;
  if (typeof value !== 'string') throw new Error(`menu.${layout} must be a path string.`);
  if (isExternalPath(value)) return { layout, lang, external: value };
  const route = outputRoute(localizedPath(value, lang, hexo));
  if (!/\.html?$/.test(route)) throw new Error(`menu.${layout}: expected an HTML page path.`);
  return { layout, lang, route, source: route.replace(/\.html?$/, '.md') };
}

async function sourceFiles(hexo, dir = hexo.source_dir, ancestors = new Set()) {
  if (!await exists(dir)) return [];
  const real = await fs.realpath(dir);
  if (ancestors.has(real)) throw new Error(`Source directory contains a symbolic-link cycle: ${dir}`);
  const parents = new Set([...ancestors, real]);
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(dir, entry.name);
    const relative = path.relative(hexo.source_dir, file).split(path.sep).join('/');
    if (hexo.source.options.ignored.some(pattern => pattern.test(relative))) continue;
    if (['_posts', '_drafts', '_data', '.git', 'node_modules'].includes(entry.name)) continue;
    const stat = entry.isSymbolicLink() ? await fs.stat(file) : entry;
    if (stat.isDirectory()) files.push(...await sourceFiles(hexo, file, parents));
    else if (stat.isFile()) files.push(file);
  }
  return files;
}

function sourceMatch(hexo, relative) {
  for (const processor of hexo.extend.processor.list()) {
    const params = processor.pattern.match(relative);
    if (params && Object.hasOwn(params, 'renderable')) return params;
  }
}

async function readPages(hexo) {
  const pages = [];
  for (const file of await sourceFiles(hexo)) {
    const source = displayPath({ base_dir: hexo.source_dir }, file);
    const match = sourceMatch(hexo, source);
    if (!match) continue;
    const output = hexo.render.getOutput(source);
    const markdown = /\.(md|markdown)$/i.test(source);
    if (match.renderable && markdown && output !== 'html') throw new Error(`${source}: install a Markdown-to-HTML renderer in the Hexo site.`);
    if (!match.renderable || !['html', 'htm'].includes(output)) {
      pages.push({ file, source, route: source });
      continue;
    }
    const text = (await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const front = split(text);
    let data = {};
    if (front.data) {
      const json = front.separator.startsWith(';');
      data = hexo.render.renderSync({ path: file, text: json ? `{${front.data}}` : escape(front.data), engine: json ? 'json' : 'yaml' });
      // Hexo treats unprefixed YAML scalars, including setext headings, as body text.
      if (!front.prefixSeparator && !json && (data === null || typeof data !== 'object')) data = {};
      if (!isRecord(data)) throw new Error(`${file}: Front Matter must be an object.`);
    }
    const route = data.permalink === undefined
      ? `${source.slice(0, -path.posix.extname(source).length)}.${output}`
      : outputRoute(data.permalink);
    pages.push({ file, source, route, layout: data.layout, lang: pageLanguageValue({ ...data, path: route }, hexo) });
  }
  return pages;
}

async function readData(hexo, name) {
  const files = await variants(path.join(hexo.source_dir, '_data'), name);
  if (files.length > 1) throw new Error(`Multiple data files for ${name}: ${files.join(', ')}.`);
  if (!files.length) return null;
  const [file] = files;
  const value = await hexo.render.render({ path: file });
  const errors = validateData(name, value);
  if (errors.length) throw new Error(`${file}:\n${errors.map(error => `- ${error}`).join('\n')}`);
  return { file, value };
}

async function readSite(hexo, includePages) {
  const defaults = await readObject(hexo, path.join(hexo.theme_dir, '_config.yml'));
  const overrides = hexo.config.theme_config === undefined ? {} : hexo.config.theme_config;
  if (!isRecord(overrides)) throw new Error('theme_config must be a configuration object.');
  const theme = deepMerge(defaults, overrides);
  const languages = configuredLanguages(hexo);
  return { hexo, theme, languages, pages: includePages ? await readPages(hexo) : [] };
}

function reservedRoutes(site) {
  const { hexo, languages } = site;
  const routes = new Set();
  for (const lang of languages) {
    routes.add(outputRoute(homePath(lang, hexo)));
    for (const [type, dir] of [['archive', hexo.config.archive_dir ?? 'archives'], ['tag', hexo.config.tag_dir ?? 'tags']]) {
      if (type === 'tag' && hexo.config.tag_generator?.enable_index_page === false) continue;
      routes.add(outputRoute(localizedPath(`/${directory(dir, `${type}_dir`)}`, lang, hexo)));
    }
  }
  return routes;
}

module.exports = { isRecord, exists, displayPath, readObject, variants, outputRoute, pageTarget, sourceMatch, readData, readSite, reservedRoutes };
