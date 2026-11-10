'use strict';

const { stringify } = require('hexo-front-matter');

function pageContent(layout, lang, route) {
  const chinese = lang.toLowerCase().startsWith('zh');
  const titles = chinese
    ? { about: '关于', friends: '友链', '404': '页面未找到' }
    : { about: 'About', friends: 'Friends', '404': 'Page not found' };
  let content = '';
  if (layout === 'about') {
    content = chinese
      ? '\n## 关于本站\n介绍博客的内容与方向。\n\n## 关于我\n介绍自己的兴趣与经历。\n'
      : '\n## About this site\nIntroduce the subjects and purpose of your blog.\n\n## About me\nIntroduce your interests and background.\n';
  }
  return stringify({ title: titles[layout], layout, lang, permalink: route, _content: content }, {
    prefixSeparator: true
  });
}

const projects = `# Add one entry per project. Text fields also accept language-keyed values.
# - name: Example Project
#   kind: Open-source tool
#   status: Maintained
#   description: A short description of the project.
#   tags: [Hexo]
#   source: https://github.com/example/project
#   demo: /tools/example/
[]
`;

const friends = `# Add groups and links to the list below.
# groups:
#   - name: Blogs
#     items:
#       - name: Example
#         url: https://example.com
#         description: A short description of the site.
groups: []
`;

module.exports = { pageContent, projects, friends };
