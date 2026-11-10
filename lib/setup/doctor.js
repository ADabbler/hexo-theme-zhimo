'use strict';

const path = require('path');
const { createRequire } = require('module');
const { exists, displayPath, isRecord, readSite, readData, variants, outputRoute, reservedRoutes } = require('./files');
const { cleanRoutePath, localizedPath, isExternalPath, directory, homePath } = require('../language');

function checkRoutes(site, report) {
  const { hexo, theme, languages, pages } = site;
  const routeSources = new Map();
  for (const page of pages) {
    if (routeSources.has(page.route)) report('error', `${page.route}: both ${routeSources.get(page.route)} and ${page.source} produce this route.`);
    routeSources.set(page.route, page.source);
    if (page.lang && !languages.includes(page.lang)) report('error', `${page.source}: language ${page.lang} is absent from the site language configuration.`);
  }
  const generated = reservedRoutes(site);
  for (const [name, value] of Object.entries(theme.menu)) {
    if (typeof value !== 'string') {
      report('error', `${name}: expected a navigation path string.`);
      continue;
    }
    if (isExternalPath(value) || ['menu.about', 'menu.friends'].includes(name)) continue;
    const menuPath = cleanRoutePath(value);
    for (const lang of languages) {
      let target = value;
      if (!menuPath) target = homePath(lang, hexo);
      else if (name === 'menu.archives' && menuPath === 'archives') target = `/${directory(hexo.config.archive_dir ?? 'archives', 'archive_dir')}`;
      const route = outputRoute(localizedPath(target, lang, hexo));
      if (!generated.has(route) && !routeSources.has(route)) report('error', `${name} (${lang}): missing navigation target ${route}. Create its page or update the menu path.`);
    }
  }
}

function checkPostPaths(site, report) {
  const { hexo, theme, languages } = site;
  const usesPostRoot = String(hexo.config.permalink).includes(':post_root');
  if (!usesPostRoot) {
    if (languages.length > 1) report('warn', 'For multilingual post paths, use permalink: :post_root/:slug/ and configure post_paths.');
    return;
  }
  const postPaths = theme.post_paths;
  if (!isRecord(postPaths) || !isRecord(postPaths.language_roots)) {
    report('error', 'post_paths must define default_root and a language_roots object.');
    return;
  }
  for (const [i, lang] of languages.entries()) {
    let value = postPaths.default_root;
    if (i > 0) {
      const currentLanguage = lang.toLowerCase();
      const match = Object.keys(postPaths.language_roots).find(code => {
        const normalized = code.toLowerCase();
        return currentLanguage === normalized || currentLanguage.startsWith(`${normalized}-`);
      });
      value = postPaths.language_roots[match];
    }
    try {
      directory(value, `post_paths (${lang})`);
    } catch (error) {
      report('error', error.message);
    }
  }
  const defaults = hexo.config.permalink_defaults;
  if (defaults?.lang !== undefined && defaults.lang !== languages[0]) report('error', `permalink_defaults.lang must match the default language ${languages[0]}.`);
  if (defaults?.post_root !== undefined && cleanRoutePath(defaults.post_root) !== cleanRoutePath(postPaths.default_root)) report('error', 'permalink_defaults.post_root must match post_paths.default_root.');
}

module.exports = async function doctor(hexo) {
  const site = await readSite(hexo, true);
  const { theme } = site;
  const issues = [];
  const requireFromSite = createRequire(path.join(hexo.base_dir, 'package.json'));
  function report(level, message) {
    issues.push({ level, message });
    hexo.log[level](`[zhimo] ${message}`);
  }
  function dependency(name) {
    try {
      requireFromSite.resolve(name);
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
      report('error', `Missing ${name}. Install it in the Hexo site or disable its integration.`);
    }
  }
  const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
  const hexoMajor = Number(hexo.version.split('.')[0]);
  if (hexoMajor < 7 || nodeMajor < 18 || (hexoMajor >= 8 && (nodeMajor < 20 || (nodeMajor === 20 && nodeMinor < 19)))) {
    report('error', `Unsupported runtime: Node ${process.versions.node}, Hexo ${hexo.version}. Use Node >=18 with Hexo 7 or Node >=20.19 with Hexo 8.`);
  }
  if (!hexo.render.isRenderable('check.ejs')) report('error', 'Install hexo-renderer-ejs in the Hexo site.');
  if (hexo.render.getOutput('check.md') !== 'html') report('error', 'Install a Markdown-to-HTML renderer, such as hexo-renderer-marked, in the Hexo site.');
  for (const asset of ['css/main.css', 'js/main.js']) {
    if (!await exists(path.join(hexo.theme_dir, 'source', asset))) report('error', `Missing theme asset source/${asset}. Build or reinstall the theme.`);
  }
  if (!isRecord(theme.menu)) throw new Error('menu must be a configuration object.');
  const configs = await variants(hexo.base_dir, `_config.${hexo.config.theme}`);
  if (configs.length > 1) report('error', `Multiple theme configurations: ${configs.map(file => displayPath(hexo, file)).join(', ')}.`);
  const components = ['404'];
  for (const layout of ['about', 'friends']) {
    if (Object.hasOwn(theme.menu, `menu.${layout}`)) components.push(layout);
  }
  try {
    const plan = await require('./index').createPlan(site, components);
    for (const entry of plan) {
      if (entry.action !== 'create') continue;
      const isDataFile = path.relative(hexo.source_dir, entry.file).split(path.sep)[0] === '_data';
      report(isDataFile ? 'warn' : 'error', `Missing ${displayPath(hexo, entry.file)}. Run hexo zhimo init ${components.join(',')}.`);
    }
  } catch (error) {
    report('error', error.message);
  }
  checkRoutes(site, report);
  for (const [component, name] of [['about', 'projects'], ['friends', 'friends']]) {
    if (components.includes(component)) continue;
    try {
      await readData(hexo, name);
    } catch (error) {
      report('error', error.message);
    }
  }
  if (!isRecord(theme.search) || typeof theme.search.enable !== 'boolean') {
    report('error', 'search.enable must be a boolean in the theme configuration.');
  } else if (theme.search.enable) {
    dependency('hexo-generator-searchdb');
    const output = hexo.config.search?.path ?? 'search.xml';
    if (theme.search.path !== output) report('error', `Theme search.path (${theme.search.path}) differs from root search.path (${output}). Set them to the same output path.`);
  }
  for (const [key, name] of [['photoswipe', 'photoswipe'], ['obsidian_callout', 'hexo-obsidian-callout']]) {
    const config = hexo.config[key];
    if (config === undefined) continue;
    if (!isRecord(config) || (config.enabled !== undefined && typeof config.enabled !== 'boolean')) {
      report('error', `${key}.enabled must be a boolean in the root site configuration.`);
    } else if (config.enabled) {
      dependency(name);
      for (const extension of ['css', 'js']) {
        const asset = `${extension}/${key.replace('_', '-')}.${extension}`;
        if (!await exists(path.join(hexo.theme_dir, 'source', asset))) report('error', `Missing ${key} theme asset ${asset}. Build or reinstall the theme.`);
      }
    }
  }
  checkPostPaths(site, report);
  const missingIcons = [];
  for (const asset of ['favicon.ico', 'favicon-32x32.png', 'favicon-16x16.png', 'apple-touch-icon.png', 'site.webmanifest']) {
    if (!await exists(path.join(hexo.source_dir, asset))) missingIcons.push(asset);
  }
  if (missingIcons.length) report('warn', `Add site branding assets under ${displayPath(hexo, hexo.source_dir)}: ${missingIcons.join(', ')}.`);
  const scaffold = path.join(hexo.scaffold_dir, 'post.md');
  if (!await exists(scaffold)) report('warn', `Add an article scaffold at ${displayPath(hexo, scaffold)}; see the content configuration guide.`);
  const errors = issues.filter(issue => issue.level === 'error').length;
  const warnings = issues.length - errors;
  hexo.log.info(`[zhimo] ${errors} error(s), ${warnings} warning(s).`);
  if (errors) throw new Error('[zhimo] Site checks failed. Resolve the reported errors and run hexo zhimo doctor again.');
  return issues;
};
