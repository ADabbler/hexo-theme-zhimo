'use strict';

const { run } = require('../lib/setup');

hexo.extend.console.register('zhimo', 'Initialize and check a ZhiMo site.', {
  usage: 'init [about,friends,404,config] [--dry-run]\n       hexo zhimo doctor',
  // Hexo sorts argument metadata alphabetically; a static list keeps init first.
  description: `Initialize and check a ZhiMo site.

Arguments:
  init    Create missing site files; omit the component list to initialize all.
  doctor  Check site configuration, pages, data and dependencies.`,
  options: [{ name: '--dry-run', desc: 'Preview files to create or keep (init only).' }]
}, function(args) {
  return run(this, args);
});
