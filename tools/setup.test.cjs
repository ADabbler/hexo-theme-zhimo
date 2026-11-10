'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Hexo = require('hexo');
const { camelCaseKeys } = require('hexo-util');
const { parseArguments, run } = require('../lib/setup');

async function fixture(options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhimo-setup-test-'));
  await fs.mkdir(path.join(root, 'themes'), { recursive: true });
  await fs.symlink(path.resolve(__dirname, '..'), path.join(root, 'themes/zhimo'), 'dir');
  await fs.symlink(path.resolve(__dirname, '../node_modules'), path.join(root, 'node_modules'), 'dir');
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({
    name: 'zhimo-setup-test', version: '1.0.0', hexo: { version: Hexo.version },
    dependencies: { 'hexo-renderer-ejs': '*' }
  }));
  const config = { theme: 'zhimo', url: 'https://example.com/blog', language: ['zh-CN', 'en'], ...options };
  await fs.writeFile(path.join(root, '_config.yml'), JSON.stringify(config));
  const hexo = new Hexo(root, { silent: true });
  await hexo.init();
  // These tests inspect source metadata, while end-to-end generation uses a real renderer.
  hexo.extend.renderer.register('md', 'html', data => data.text, true);
  const messages = [];
  for (const level of ['info', 'warn', 'error']) hexo.log[level] = message => messages.push({ level, message });
  async function write(file, content) {
    const target = path.join(root, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
    return target;
  }
  return { root, hexo, messages, write, read: file => fs.readFile(path.join(root, file), 'utf8') };
}

test('positional components, ordering and CLI option aliases', () => {
  const args = camelCaseKeys({ _: ['init', 'friends,about,friends'], 'dry-run': true });
  assert.deepEqual(parseArguments(args), { command: 'init', components: ['about', 'friends'], dryRun: true });
  assert.equal(parseArguments({ _: ['init'] }).components.length, 4);
  for (const args of [
    { _: ['init', 'friends,'] }, { _: ['init', 'unknown'] }, { _: ['init', 'projects'] }, { _: ['init'], force: true },
    { _: ['init'], only: 'friends' }, { _: ['doctor', 'friends'] }, { _: ['doctor'], dryRun: true },
    { _: ['init'], dryRun: 'false' }, { _: ['init', 'about', 'friends'] }, { _: ['unknown'] }
  ]) assert.throws(() => parseArguments(args));
});

test('preview, multilingual output and repeated initialization preserve contents', async () => {
  const site = await fixture({ source_dir: 'content' });
  assert.ok(site.hexo.extend.console.get('zhimo'));
  const preview = await run(site.hexo, { _: ['init'], dryRun: true });
  assert.equal(preview.filter(entry => entry.action === 'create').length, 9);
  await assert.rejects(fs.stat(path.join(site.root, 'content')), { code: 'ENOENT' });
  assert.deepEqual(site.hexo.route.list(), []);
  const created = await run(site.hexo, { _: ['init'] });
  const saved = await Promise.all(created.map(async entry => [entry.file, await fs.readFile(entry.file, 'utf8')]));
  assert.match(await site.read('content/404.md'), /permalink: 404.html/);
  assert.match(await site.read('content/en/404/index.md'), /permalink: en\/404\/index.html/);
  assert.match(await site.read('content/about/index.md'), /关于本站/);
  assert.match(await site.read('content/en/about/index.md'), /About this site/);
  assert.equal(await site.read('_config.zhimo.yml'), await fs.readFile(path.resolve(__dirname, '../_config.yml'), 'utf8'));
  const second = await run(site.hexo, { _: ['init'] });
  assert.ok(second.every(entry => entry.action === 'keep'));
  for (const [file, contents] of saved) assert.equal(await fs.readFile(file, 'utf8'), contents);
});

test('partial initialization only creates the selected component files', async () => {
  const site = await fixture();
  const plan = await run(site.hexo, { _: ['init', 'friends,friends'] });
  assert.equal(plan.length, 3);
  await assert.rejects(fs.stat(path.join(site.root, 'source/about')), { code: 'ENOENT' });
  assert.match(await site.read('source/_data/friends.yml'), /groups: \[\]/);
  await assert.rejects(fs.stat(path.join(site.root, '_config.zhimo.yml')), { code: 'ENOENT' });
});

test('custom menu paths, existing permalinks, data formats and root configuration', async () => {
  const site = await fixture({ language: 'en', theme_config: { menu: { 'menu.about': '/me/' } } });
  await site.write('source/profile.md', '---\nlayout: about\nlang: en\npermalink: me/\n---\nMy own content\n');
  const projects = '[{"name":"Existing project","demo":"/tools/"}]\n';
  await site.write('source/_data/projects.json', projects);
  const plan = await run(site.hexo, { _: ['init', 'about,config'] });
  assert.ok(plan.every(entry => entry.action === 'keep'));
  assert.equal(await site.read('source/_data/projects.json'), projects);
  await assert.rejects(fs.stat(path.join(site.root, 'source/me')), { code: 'ENOENT' });
  await assert.rejects(fs.stat(path.join(site.root, '_config.zhimo.yml')), { code: 'ENOENT' });
});

test('configuration variants are kept instead of creating a competing override', async () => {
  const site = await fixture({ language: 'en' });
  await site.write('_config.zhimo.json', '{"site":{"subtitle":"My notes"}}\n');
  const plan = await run(site.hexo, { _: ['init', 'config'] });
  assert.equal(plan[0].action, 'keep');
  await assert.rejects(fs.stat(path.join(site.root, '_config.zhimo.yml')), { code: 'ENOENT' });
});

test('route and layout conflicts stop the whole plan before writing', async () => {
  const site = await fixture({ language: 'en' });
  await site.write('source/intro.md', '---\nlayout: page\npermalink: about/\n---\nExisting\n');
  await assert.rejects(run(site.hexo, { _: ['init'] }), /requires layout/);
  await assert.rejects(fs.stat(path.join(site.root, 'source/friends')), { code: 'ENOENT' });
  await assert.rejects(fs.stat(path.join(site.root, 'source/_data')), { code: 'ENOENT' });
});

test('two source files for the same route are reported', async () => {
  const site = await fixture({ language: 'en' });
  const text = '---\nlayout: about\npermalink: about/\n---\n';
  await site.write('source/one.md', text);
  await site.write('source/two.md', text);
  await assert.rejects(run(site.hexo, { _: ['init', 'about'] }), /multiple sources/);
});

test('malformed data and duplicate formats fail explicitly without creating pages', async () => {
  const invalid = await fixture({ language: 'en' });
  await invalid.write('source/_data/projects.json', '[{"name":"Project","demo":"javascript:alert(1)"}]');
  await assert.rejects(run(invalid.hexo, { _: ['init'] }), /projects\[0\].demo/);
  await assert.rejects(fs.stat(path.join(invalid.root, 'source/about')), { code: 'ENOENT' });
  const duplicate = await fixture();
  await duplicate.write('source/_data/friends.yml', 'groups: []\n');
  await duplicate.write('source/_data/friends.json', '{"groups":[]}');
  await assert.rejects(run(duplicate.hexo, { _: ['init', 'friends'] }), /Multiple data files/);
});

test('list-generator routes and excluded destinations fail explicitly', async () => {
  const collision = await fixture({ language: 'en', theme_config: { menu: { 'menu.about': '/archives/' } } });
  await assert.rejects(run(collision.hexo, { _: ['init', 'about'] }), /list generator/);
  const excluded = await fixture({ language: 'en', exclude: ['about/**'] });
  await assert.rejects(run(excluded.hexo, { _: ['init', 'about'] }), /excluded/);
});

test('doctor reports actionable warnings and errors without initializing files', async () => {
  const good = await fixture({ language: 'en', theme_config: { search: { enable: false } } });
  await run(good.hexo, { _: ['init'] });
  const before = await good.read('source/about/index.md');
  const warnings = await run(good.hexo, { _: ['doctor'] });
  assert.ok(warnings.some(issue => issue.level === 'warn' && issue.message.includes('branding')));
  assert.equal(await good.read('source/about/index.md'), before);
  const bad = await fixture({ language: 'en' });
  await assert.rejects(run(bad.hexo, { _: ['doctor'] }), /Site checks failed/);
  assert.ok(bad.messages.some(entry => entry.message.includes('hexo-generator-searchdb')));
  await assert.rejects(fs.stat(path.join(bad.root, 'source')), { code: 'ENOENT' });
});

test('JSON Front Matter and custom navigation targets are recognized', async () => {
  const site = await fixture({ language: 'en', theme_config: { search: { enable: false }, menu: { 'menu.notes': '/notes/' } } });
  await site.write('source/about.md', ';;;\n"layout":"about",\n"lang":"en",\n"permalink":"about/"\n;;;\nAbout\n');
  await run(site.hexo, { _: ['init'] });
  await assert.rejects(run(site.hexo, { _: ['doctor'] }), /Site checks failed/);
  assert.ok(site.messages.some(entry => entry.message.includes('menu.notes (en): missing navigation target')));
  await site.write('source/notes/index.md', '---\ntitle: Notes\n---\nNotes\n');
  await run(site.hexo, { _: ['doctor'] });
});

test('external navigation is explicit and does not create a local page', async () => {
  const site = await fixture({ language: 'en', theme_config: { menu: { 'menu.about': 'https://example.com/about/' } } });
  const plan = await run(site.hexo, { _: ['init', 'about'] });
  assert.ok(plan.some(entry => entry.reason?.includes('external link')));
  await assert.rejects(fs.stat(path.join(site.root, 'source/about')), { code: 'ENOENT' });
  assert.match(await site.read('source/_data/projects.yml'), /\[\]/);
});

test('invalid page configuration and missing Markdown renderer fail before writing', async () => {
  const site = await fixture({ language: 'en', theme_config: { menu: { 'menu.about': null } } });
  await assert.rejects(run(site.hexo, { _: ['init', 'about'] }), /path string/);
  const renderer = await fixture();
  renderer.hexo.extend.renderer.register('md', 'txt', data => data.text, true);
  await assert.rejects(run(renderer.hexo, { _: ['init'] }), /Markdown-to-HTML renderer/);
  await assert.rejects(fs.stat(path.join(renderer.root, 'source')), { code: 'ENOENT' });
});

test('optional empty data fields are preserved and required names remain validated', async () => {
  const site = await fixture({ language: 'en' });
  const projects = '[{"name":{"en":"Project","zh-CN":null},"description":null,"tags":null,"source":""}]';
  await site.write('source/_data/projects.json', projects);
  await site.write('source/_data/friends.yml', 'intro: My links\n');
  await run(site.hexo, { _: ['init', 'about,friends'] });
  assert.equal(await site.read('source/_data/projects.json'), projects);
  await site.write('source/_data/projects.json', '[{"name":{"en":null}}]');
  await assert.rejects(run(site.hexo, { _: ['init', 'about'] }), /nonempty project name/);
});

test('pages skipped by the renderer cannot satisfy initialization', async () => {
  const site = await fixture({ language: 'en', skip_render: ['about/**'] });
  await assert.rejects(run(site.hexo, { _: ['init', 'about'] }), /source configuration/);
  await assert.rejects(fs.stat(path.join(site.root, 'source/about')), { code: 'ENOENT' });
  await site.write('source/about/index.md', '---\nlayout: about\nlang: en\n---\nExisting page\n');
  await assert.rejects(run(site.hexo, { _: ['init', 'about'] }), /does not produce/);
});

test('doctor treats missing pages as errors when a parent directory is named _data', async () => {
  const site = await fixture({
    language: 'en', source_dir: 'private/_data/content',
    theme_config: { search: { enable: false } }
  });
  await assert.rejects(run(site.hexo, { _: ['doctor'] }), /Site checks failed/);
  assert.ok(site.messages.some(entry => entry.level === 'error' && entry.message.includes('about/index.md')));
});

test('data URL validation checks the protocol after trimming spaces', () => {
  const validateData = require('../lib/setup/data');
  for (const url of ['  javascript:alert(1)', '  ftp://example.com', ' https://bad host/']) {
    assert.ok(validateData('projects', [{ name: 'Project', demo: url }]).length > 0);
  }
  assert.ok(validateData('friends', { groups: [{ items: [{ url: ' javascript:alert(1)' }] }] }).length > 0);
  assert.deepEqual(validateData('projects', [{ name: 'Project', demo: ' https://example.com/ ' }]), []);
});

test('plain Markdown separators and setext headings are not Front Matter errors', async () => {
  const site = await fixture({ language: 'en', theme_config: { search: { enable: false } } });
  const rule = '---\n# Notes\nA plain Markdown page.\n';
  const heading = 'Notes\n---\nA plain Markdown page.\n';
  await site.write('source/rule.md', rule);
  await site.write('source/heading.md', heading);
  await run(site.hexo, { _: ['init'] });
  await run(site.hexo, { _: ['doctor'] });
  assert.equal(await site.read('source/rule.md'), rule);
  assert.equal(await site.read('source/heading.md'), heading);
});
