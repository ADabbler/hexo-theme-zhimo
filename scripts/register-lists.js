'use strict';

const { GENERATOR_NAMES, getListings } = require('../lib/listings');
const { pageLanguageValue } = require('../lib/language');
const listings = getListings(hexo);
const registered = new Map();
const writtenRoutes = new Set();
let generating = false;

hexo.extend.filter.register('after_init', function() {
  for (const name of GENERATOR_NAMES) {
    hexo.extend.generator.register(name, function(locals) {
      return listings.generate(name, locals);
    });
    registered.set(name, hexo.extend.generator.get(name));
  }
});

hexo.extend.filter.register('before_generate', function() {
  for (const [name, generator] of registered) {
    if (hexo.extend.generator.get(name) !== generator) {
      throw new Error(`[ZhiMo] The "${name}" generator was replaced after theme initialization. Use only one generator for these list pages.`);
    }
  }
  listings.reset();
  writtenRoutes.clear();
  generating = true;
});

hexo.route.on('update', function(path) {
  if (!generating || !listings.hasPath(path)) return;
  if (writtenRoutes.has(path)) {
    throw new Error(`[ZhiMo] Another page or generator also produces "${path}". Remove the conflicting route or change its path.`);
  }
  writtenRoutes.add(path);
});

// HTML processors may replace routes after generation; only generator writes compete.
hexo.on('generateAfter', function() {
  generating = false;
});

hexo.extend.filter.register('template_locals', function(locals) {
  if (locals.page && typeof locals.page === 'object') {
    locals.page.lang = pageLanguageValue(locals.page, hexo);
  }
  return locals;
});
