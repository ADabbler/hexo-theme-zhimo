'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const GENERATOR_NAME = 'zhimo_photoswipe_assets';
const PACKAGE_NAME = 'photoswipe';
const HASH_LENGTH = 10;
const PADDING_SIDES = ['top', 'bottom', 'left', 'right'];
const DEFAULT_SELECTOR = '.post-content :not(a) > img, .post-content > img';
const DEFAULT_PADDING = 24;
const DEFAULT_EXCLUDE = [
  '.no-lightbox',
  '.no-zoom',
  '[data-no-lightbox]',
  '[data-no-zoom]',
  '[data-no-photoswipe]'
];
const THEME_ASSETS = ['css/photoswipe.css', 'js/photoswipe.js'];
const VENDOR_ROUTES = {
  module: 'js/photoswipe/vendor.esm.min.js',
  style: 'css/photoswipe/vendor.css'
};

// Optional integration, configured by the site root `photoswipe` key.
const config = hexo.config.photoswipe || {};

if (config.enabled === true) {
  registerPhotoSwipe();
}

function registerPhotoSwipe() {
  warnOnMissingThemeAssets();

  const vendor = resolveVendor();
  if (!vendor) return;

  const assets = {
    module: buildAsset(VENDOR_ROUTES.module, fs.readFileSync(vendor.module)),
    style: buildAsset(VENDOR_ROUTES.style, fs.readFileSync(vendor.style))
  };

  hexo.extend.generator.register(GENERATOR_NAME, function() {
    return Object.values(assets).map(asset => ({
      path: asset.route,
      data: asset.data
    }));
  });

  // Injected at head_begin, so the vendor rules precede the theme stylesheet in
  // the cascade.
  hexo.extend.injector.register('head_begin', renderHeadTags(assets), 'post');
}

function warnOnMissingThemeAssets() {
  THEME_ASSETS.forEach(asset => {
    const sourcePath = path.join(hexo.theme_dir, 'source', asset);
    if (fs.existsSync(sourcePath)) return;

    hexo.log.warn(`[photoswipe] missing theme asset ${asset}; run the theme build before generating.`);
  });
}

function resolveVendor() {
  const siteRequire = createRequire(path.join(hexo.base_dir, 'package.json'));

  try {
    // The package exports map exposes the entry point but not the minified
    // module subpath.
    const moduleEntry = siteRequire.resolve(PACKAGE_NAME);

    return {
      module: path.join(path.dirname(moduleEntry), 'photoswipe.esm.min.js'),
      style: siteRequire.resolve(`${PACKAGE_NAME}/dist/photoswipe.css`)
    };
  } catch (error) {
    if (error && (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED')) {
      hexo.log.warn('[photoswipe] photoswipe.enabled is true, but the photoswipe package is not installed.');
      return null;
    }

    throw error;
  }
}

function buildAsset(route, data) {
  return {
    route: assetRouteWithHash(route, contentHash(data)),
    data
  };
}

function contentHash(data) {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex')
    .slice(0, HASH_LENGTH);
}

function assetRouteWithHash(route, hash) {
  const extension = path.extname(route);
  if (!extension || !hash) return route;

  return `${route.slice(0, -extension.length)}.${hash}${extension}`;
}

function rootUrl(route) {
  const root = String(hexo.config.root || '/').replace(/\/?$/, '/');
  return `${root}${String(route).replace(/^\/+/, '')}`;
}

function renderHeadTags(assets) {
  return [
    `<link rel="stylesheet" href="${rootUrl(assets.style.route)}">`,
    `<script>window.ZhiMoPhotoSwipe=${serializeForInlineScript(clientConfig(assets.module.route))}</script>`
  ].join('');
}

function serializeForInlineScript(value) {
  return JSON.stringify(value)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function clientConfig(moduleRoute) {
  return {
    modulePath: rootUrl(moduleRoute),
    selector: config.selector || DEFAULT_SELECTOR,
    exclude: DEFAULT_EXCLUDE.concat(toArray(config.exclude)),
    bgOpacity: boundedNumber(config.bg_opacity, 0.96, 0, 1),
    padding: normalizePadding(config.padding, DEFAULT_PADDING),
    mainClass: 'pswp--zhimo',
    wheelToZoom: config.wheel_to_zoom !== false,
    initialZoomLevel: zoomLevel(config.initial_zoom_level, 'fit'),
    secondaryZoomLevel: zoomLevel(config.secondary_zoom_level, 1),
    maxZoomLevel: zoomLevel(config.max_zoom_level, 4),
    minZoomFactor: boundedNumber(config.min_zoom_factor, 0.5, 0.1, 1)
  };
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function nonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function normalizePadding(value, fallback) {
  const fallbackPadding = nonNegativeNumber(fallback, DEFAULT_PADDING);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return paddingObject(nonNegativeNumber(value, fallbackPadding));
  }

  return PADDING_SIDES.reduce((padding, side) => {
    padding[side] = nonNegativeNumber(value[side], fallbackPadding);
    return padding;
  }, {});
}

function paddingObject(value) {
  return PADDING_SIDES.reduce((padding, side) => {
    padding[side] = value;
    return padding;
  }, {});
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function zoomLevel(value, fallback) {
  if (value === 'fit' || value === 'fill') return value;

  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
