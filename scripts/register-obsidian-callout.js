'use strict';

const path = require('path');
const { createRequire } = require('module');

const CALLOUT_CSS_GENERATOR = 'hexo-obsidian-callout-css';
const CALLOUT_PACKAGE = 'hexo-obsidian-callout';
const calloutConfig = hexo.config.obsidian_callout || {};

if (calloutConfig.enabled === true) {
  const registerCallout = loadCalloutPackage();

  if (typeof registerCallout === 'function') {
    hexo.config.obsidian_callout = {
      ...calloutConfig,
      injectHead: false
    };

    registerCallout(hexo);

    if (hexo.extend.generator.get(CALLOUT_CSS_GENERATOR)) {
      delete hexo.extend.generator.store[CALLOUT_CSS_GENERATOR];
    }
  } else if (registerCallout) {
    hexo.log.warn('[zhimo] hexo-obsidian-callout did not export a registration function.');
  }
}

// Optional site packages resolve from the site root, not from the theme
// scripts directory.
function requireFromSite(moduleName) {
  return createRequire(path.join(hexo.base_dir, 'package.json'))(moduleName);
}

function loadCalloutPackage() {
  try {
    return requireFromSite(CALLOUT_PACKAGE);
  } catch (error) {
    if (!isMissingCalloutPackage(error)) {
      throw error;
    }

    hexo.log.warn('[zhimo] obsidian_callout.enabled is true, but hexo-obsidian-callout is not installed.');
    return null;
  }
}

function isMissingCalloutPackage(error) {
  return Boolean(
    error &&
    error.code === 'MODULE_NOT_FOUND' &&
    String(error.message || '').includes(CALLOUT_PACKAGE)
  );
}
