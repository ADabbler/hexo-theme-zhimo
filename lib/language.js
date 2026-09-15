'use strict';

const FILE_EXTENSION_PATTERN = /\.[a-z0-9]+$/i;

function normalizeLanguage(lang, fallback) {
  return String(lang || fallback || '').toLowerCase();
}

function configuredLanguages(ctx) {
  const value = ctx.config.language;
  const values = Array.isArray(value) ? value : [value];
  const languages = new Map();

  for (const lang of values) {
    if (lang == null || lang === '' || lang === 'default') continue;
    if (typeof lang !== 'string' || !/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(lang)) {
      throw new TypeError('[ZhiMo] language must contain language codes such as en or zh-CN.');
    }
    languages.set(normalizeLanguage(lang), lang);
  }

  return languages.size ? Array.from(languages.values()) : ['en'];
}

function defaultLanguage(ctx) {
  return configuredLanguages(ctx)[0];
}

function findConfiguredLanguage(lang, ctx) {
  const normalized = normalizeLanguage(lang);
  return configuredLanguages(ctx).find(item => normalizeLanguage(item) === normalized);
}

function languageForValue(lang, ctx) {
  if (!lang || lang === 'default') return defaultLanguage(ctx);
  return findConfiguredLanguage(lang, ctx) || lang;
}

function languageFromPath(value, ctx) {
  const firstSegment = String(value || '').replace(/^\/+/, '').split('/')[0];
  return findConfiguredLanguage(firstSegment, ctx) || '';
}

function pageLanguageValue(page, ctx) {
  return languageForValue(page && (page.lang || languageFromPath(page.path, ctx)), ctx);
}

function pageLanguage(page, ctx) {
  return normalizeLanguage(pageLanguageValue(page, ctx));
}

function isDefaultLanguage(lang, ctx) {
  return normalizeLanguage(lang) === normalizeLanguage(defaultLanguage(ctx));
}

function languagePrefix(lang, ctx) {
  const target = languageForValue(lang, ctx);
  return isDefaultLanguage(target, ctx) ? '' : `${target}/`;
}

function cleanRoutePath(value) {
  return String(value || '')
    .replace(/^\/+/, '')
    .replace(/\/index\.html$/, '')
    .replace(/^index\.html$/, '')
    .replace(/\/+$/, '');
}

function routeWithoutLanguage(value, ctx) {
  const route = cleanRoutePath(value);
  const segments = route.split('/').filter(Boolean);
  if (languageFromPath(route, ctx)) segments.shift();
  return segments.join('/');
}

function routeToUrlPath(value) {
  const route = String(value || '').replace(/^\/+/, '');
  if (!route || route === 'index.html') return '/';
  if (route.endsWith('/index.html')) return `/${route.slice(0, -10)}`;
  if (route.endsWith('/') || FILE_EXTENSION_PATTERN.test(route)) return `/${route}`;
  return `/${route}/`;
}

function isExternalPath(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(String(value || ''));
}

function localizedPath(value, lang, ctx) {
  if (isExternalPath(value)) return value;
  const route = routeWithoutLanguage(value, ctx);
  if (FILE_EXTENSION_PATTERN.test(route)) return `/${route}`;
  const localized = `${languagePrefix(lang, ctx)}${route}`.replace(/\/+/g, '/');
  return routeToUrlPath(localized);
}

function directory(value, name) {
  if (typeof value !== 'string' || /[?#\\]/.test(value)) {
    throw new TypeError(`[ZhiMo] ${name} must be a directory path.`);
  }
  const segments = value.split('/').filter(Boolean);
  if (segments.some(segment => segment === '.' || segment === '..')) {
    throw new TypeError(`[ZhiMo] ${name} cannot contain . or .. path segments.`);
  }
  return segments.length ? `${segments.join('/')}/` : '';
}

function homePath(lang, ctx) {
  const base = directory(ctx.config.index_generator?.path ?? '', 'index_generator.path');
  return routeToUrlPath(`${languagePrefix(lang, ctx)}${base}`);
}

module.exports = {
  FILE_EXTENSION_PATTERN,
  cleanRoutePath,
  configuredLanguages,
  defaultLanguage,
  directory,
  homePath,
  isDefaultLanguage,
  isExternalPath,
  languageForValue,
  languagePrefix,
  localizedPath,
  normalizeLanguage,
  pageLanguage,
  pageLanguageValue,
  routeToUrlPath,
  routeWithoutLanguage
};
