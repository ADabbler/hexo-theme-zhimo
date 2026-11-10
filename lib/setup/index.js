'use strict';

const fs = require('fs/promises');
const path = require('path');
const templates = require('./templates');
const { exists, displayPath, readObject, variants, readSite, readData, pageTarget, sourceMatch, reservedRoutes } = require('./files');

const COMPONENTS = ['about', 'friends', '404', 'config'];
const ALLOWED_OPTIONS = new Set(['_', 'config', 'cwd', 'debug', 'safe', 'silent', 'draft', 'drafts', 'h', 'help', 'dryRun', 'dry-run']);

function parseArguments(args) {
  const [command, selection, ...extra] = args._ || [];
  if (command && !['init', 'doctor'].includes(command)) throw new Error(`Unknown command "${command}". Use hexo help zhimo.`);
  for (const key of Object.keys(args)) {
    if (!ALLOWED_OPTIONS.has(key)) throw new Error(`Unknown option "${key}". Use hexo help zhimo.`);
  }
  if (args.dryRun !== undefined && (command !== 'init' || typeof args.dryRun !== 'boolean')) {
    throw new Error('--dry-run is a boolean option for init.');
  }
  if (extra.length || (command !== 'init' && selection !== undefined)) {
    throw new Error('Use hexo zhimo init [about,friends,404,config] [--dry-run] or hexo zhimo doctor.');
  }
  const requested = selection === undefined ? COMPONENTS : String(selection).split(',').map(name => name.trim());
  for (const name of requested) {
    if (!COMPONENTS.includes(name)) throw new Error(`Unknown component "${name}". Choose ${COMPONENTS.join(', ')}.`);
  }
  return { command, components: COMPONENTS.filter(name => requested.includes(name)), dryRun: args.dryRun === true };
}

async function createPlan(site, components) {
  const { hexo, theme, languages, pages } = site;
  const files = new Map();
  const errors = [];
  const reserved = reservedRoutes(site);
  const plannedRoutes = new Set();
  function keep(file, reason) {
    files.set(file, { file, action: 'keep', reason });
  }
  async function add(file, content) {
    if (files.has(file)) return;
    if (await exists(file)) keep(file, 'existing file');
    else files.set(file, { file, content, action: 'create' });
  }
  for (const layout of ['about', 'friends', '404']) {
    if (!components.includes(layout)) continue;
    for (const lang of languages) {
      const target = pageTarget(hexo, theme, layout, lang);
      if (target.external) {
        keep(`menu.${layout} (${lang})`, `external link: ${target.external}`);
        continue;
      }
      if (plannedRoutes.has(target.route) || reserved.has(target.route)) {
        errors.push(`${target.route}: the ${layout} page conflicts with another page or list generator.`);
        continue;
      }
      plannedRoutes.add(target.route);
      const matches = pages.filter(page => page.route === target.route);
      if (matches.length > 1) {
        errors.push(`${target.route}: multiple sources: ${matches.map(page => page.source).join(', ')}.`);
        continue;
      }
      if (matches.length) {
        const page = matches[0];
        if (page.layout !== layout || page.lang !== lang) {
          errors.push(`${page.source}: ${target.route} requires layout: ${JSON.stringify(layout)} and lang: ${lang}.`);
        } else keep(page.file, 'existing page');
        continue;
      }
      const elsewhere = pages.filter(page => page.layout === layout && page.lang === lang);
      if (elsewhere.length) {
        errors.push(`${layout} (${lang}): existing page ${elsewhere.map(page => page.source).join(', ')} does not match ${target.route}. Update its permalink or the menu path.`);
        continue;
      }
      const file = path.join(hexo.source_dir, target.source);
      if (await exists(file)) {
        errors.push(`${displayPath(hexo, file)} exists but does not produce ${target.route}.`);
        continue;
      }
      const match = sourceMatch(hexo, target.source);
      if (!match?.renderable || hexo.source.options.ignored.some(pattern => pattern.test(target.source))) {
        errors.push(`${target.source}: the page is excluded or skipped by the source configuration.`);
        continue;
      }
      await add(file, templates.pageContent(layout, lang, target.route));
    }
  }
  for (const [component, name] of [['friends', 'friends'], ['about', 'projects']]) {
    if (!components.includes(component)) continue;
    const data = await readData(hexo, name);
    if (data) keep(data.file, 'existing data');
    else await add(path.join(hexo.source_dir, '_data', `${name}.yml`), templates[name]);
  }
  if (components.includes('config')) {
    const configs = await variants(hexo.base_dir, `_config.${hexo.config.theme}`);
    if (configs.length > 1) errors.push(`Multiple theme configurations: ${configs.map(file => displayPath(hexo, file)).join(', ')}.`);
    if (configs.length) {
      for (const file of configs) {
        await readObject(hexo, file);
        keep(file, 'existing theme configuration');
      }
    } else {
      const root = await readObject(hexo, hexo.config_path);
      if (Object.hasOwn(root, 'theme_config')) keep(hexo.config_path, 'existing theme_config');
      else {
        const content = await fs.readFile(path.join(hexo.theme_dir, '_config.yml'), 'utf8');
        await add(path.join(hexo.base_dir, `_config.${hexo.config.theme}.yml`), content);
      }
    }
  }
  if (errors.length) throw new Error(`Initialization conflicts:\n${errors.map(error => `- ${error}`).join('\n')}`);
  return [...files.values()];
}

async function initialize(hexo, options) {
  const needsPages = options.components.some(name => ['about', 'friends', '404'].includes(name));
  if (needsPages && hexo.render.getOutput('page.md') !== 'html') {
    throw new Error('Install a Markdown-to-HTML renderer, such as hexo-renderer-marked, before creating pages.');
  }
  const site = await readSite(hexo, needsPages);
  const plan = await createPlan(site, options.components);
  for (const entry of plan) {
    const label = entry.file.startsWith('menu.') ? entry.file : displayPath(hexo, entry.file);
    if (entry.action === 'keep') {
      hexo.log.info(`[zhimo] keep ${label} (${entry.reason})`);
    } else if (options.dryRun) {
      hexo.log.info(`[zhimo] create ${label} (preview)`);
    } else {
      await fs.mkdir(path.dirname(entry.file), { recursive: true });
      // Exclusive creation also protects files added after the plan was built.
      await fs.writeFile(entry.file, entry.content, { flag: 'wx' });
      hexo.log.info(`[zhimo] created ${label}`);
    }
  }
  hexo.log.info(`[zhimo] ${options.dryRun ? 'Preview' : 'Initialization'} complete. Review the listed content, then run hexo zhimo doctor and hexo generate.`);
  return plan;
}

async function run(hexo, args) {
  const options = parseArguments(args);
  if (!options.command) return hexo.call('help', { _: ['zhimo'] });
  if (options.command === 'init') return initialize(hexo, options);
  return require('./doctor')(hexo);
}

module.exports = { parseArguments, createPlan, run };
