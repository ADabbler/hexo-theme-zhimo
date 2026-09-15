'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
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
} = require('../lib/language');
const { getListings } = require('../lib/listings');
const listings = getListings(hexo);
const CJK_CHARACTER_PATTERN = /[一-龥぀-ゟ゠-ヿ가-힯]/g;
const CJK_CHARS_PER_MINUTE = 500;
const LATIN_WORDS_PER_MINUTE = 200;
const DEFAULT_EXCERPT_LENGTH = 160;
const DEFAULT_POST_ROOT = 'posts';
const DEFAULT_FEED_PATH = 'atom.xml';
const DEFAULT_FEED_CONTENT_LIMIT = 140;
const DEFAULT_RELATED_POST_COUNT = 3;
const HTML_VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);
const RELATED_TAG_WEIGHT = 4;
const RELATED_CATEGORY_WEIGHT = 3;
const RELATED_TEXT_WEIGHT = 0.2;
const RELATED_TEXT_SCORE_CAP = 1;
const BASE_VERSIONED_THEME_ASSETS = [
  'css/fonts.css',
  'css/fonts-serif-sc.css',
  'css/main.css',
  'js/main.js',
  'js/search.js',
  'js/highlight.js'
];
const OBSIDIAN_CALLOUT_ASSETS = [
  'css/obsidian-callout.css',
  'js/obsidian-callout.js'
];
const PHOTOSWIPE_ASSETS = [
  'css/photoswipe.css',
  'js/photoswipe.js'
];
const ASSET_HASH_LENGTH = 10;
const { encodeURL, full_url_for, gravatar, stripHTML, url_for } = require('hexo-util');

function isServerCommand() {
  const cmd = (hexo.env && hexo.env.cmd) || '';
  return cmd === 'server' || cmd === 's';
}

const themeAssetHashCache = new Map();

const DEFAULT_FEED_CONFIG = {
  enable: true,
  type: 'atom',
  path: 'atom.xml',
  limit: 20,
  hub: '',
  content: true,
  content_limit: DEFAULT_FEED_CONTENT_LIMIT,
  content_limit_delim: ''
};

function toArray(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (typeof collection.toArray === 'function') return collection.toArray();
  return [];
}

function sortByDateDesc(posts) {
  return posts.slice().sort((a, b) => dateValue(b.date) - dateValue(a.date));
}

function normalizeAssetRoute(assetPath) {
  return String(assetPath || '').replace(/^\/+/, '').replace(/\/+$/, '');
}

function themeAssetSourcePath(route) {
  return path.join(hexo.theme_dir, 'source', route);
}

function hashThemeAsset(route) {
  const sourcePath = themeAssetSourcePath(route);
  const stat = fs.statSync(sourcePath);
  if (!stat.isFile()) throw new Error(`[ZhiMo] Expected a theme asset file: ${sourcePath}`);

  const cacheKey = `${stat.mtimeMs}:${stat.size}`;
  const cached = themeAssetHashCache.get(route);
  if (cached && cached.cacheKey === cacheKey) return cached.hash;

  const hash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(sourcePath))
    .digest('hex')
    .slice(0, ASSET_HASH_LENGTH);

  themeAssetHashCache.set(route, { cacheKey, hash });
  return hash;
}

function assetRouteWithHash(route, hash) {
  const extension = path.extname(route);
  if (!extension) return route;

  return `${route.slice(0, -extension.length)}.${hash}${extension}`;
}

function versionedThemeAssetRoute(assetPath) {
  const route = normalizeAssetRoute(assetPath);

  // Dev server: keep stable, unhashed URLs so live-reload never races the
  // generate-time hash swap; production keeps content-hashed routes.
  if (isServerCommand()) return route;

  return assetRouteWithHash(route, hashThemeAsset(route));
}

function registerVersionedThemeAsset(route) {
  const versionedRoute = versionedThemeAssetRoute(route);
  if (versionedRoute === route) return;

  const sourcePath = themeAssetSourcePath(route);

  hexo.route.set(versionedRoute, fs.readFileSync(sourcePath));
  hexo.route.remove(route);
}

function themeConfig() {
  return hexo.theme && hexo.theme.config ? hexo.theme.config : {};
}

function postRootForLanguage(lang) {
  const postPaths = themeConfig().post_paths || {};
  const languageRoots = postPaths.language_roots || {};
  const fallbackRoot = postPaths.default_root || DEFAULT_POST_ROOT;
  const currentLang = normalizeLanguage(lang);
  const match = Object.keys(languageRoots).find(key => {
    const rootLang = normalizeLanguage(key);
    return currentLang === rootLang || currentLang.startsWith(`${rootLang}-`);
  });

  return match ? languageRoots[match] : fallbackRoot;
}

function configuredFeed(ctx) {
  return { ...DEFAULT_FEED_CONFIG, ...(ctx.config.feed || {}) };
}

function atomFeedEnabled(feedConfig) {
  if (feedConfig.enable === false) return false;
  const type = feedConfig.type;
  if (Array.isArray(type)) return type.includes('atom');
  return !type || type === 'atom';
}

function atomFeedBasePath(ctx) {
  const feedConfig = configuredFeed(ctx);
  const type = feedConfig.type;
  const path = feedConfig.path;
  let feedPath = path;

  if (Array.isArray(path)) {
    const atomIndex = Array.isArray(type) ? type.indexOf('atom') : 0;
    feedPath = path[atomIndex >= 0 ? atomIndex : 0];
  }

  feedPath = String(feedPath || DEFAULT_FEED_PATH).replace(/^\/+/, '').replace(/\/+$/, '');
  if (!FILE_EXTENSION_PATTERN.test(feedPath)) feedPath += '.xml';

  return feedPath;
}

function atomFeedPath(lang, ctx) {
  const feedPath = atomFeedBasePath(ctx);
  const route = `${languagePrefix(lang, ctx)}${feedPath}`.replace(/\/+/g, '/');
  return `/${route}`;
}

function isPostPage(page) {
  if (!page) return false;
  if (page.layout === 'post') return true;
  return typeof page.source === 'string' && page.source.includes('_posts/');
}

function isHomePage(page, ctx) {
  return Boolean(page && page.__index) ||
    cleanRoutePath(page && page.path) === cleanRoutePath(homePath(pageLanguageValue(page, ctx), ctx));
}

function isNotFoundPage(page) {
  return Boolean(page && (page.layout === '404' || page.type === 'notfound'));
}

function notFoundPath(lang, ctx) {
  const target = languageForValue(lang, ctx);
  return isDefaultLanguage(target, ctx) ? '/404.html' : localizedPath('/404/', target, ctx);
}

function findPostTranslation(page, lang, ctx) {
  if (!page || !page.slug) return null;

  const targetLang = normalizeLanguage(lang);
  return toArray(ctx.site.posts).find(post =>
    post._id !== page._id &&
    post.slug === page.slug &&
    pageLanguage(post, ctx) === targetLang
  ) || null;
}

function routeExists(value) {
  return Boolean(value && hexo.route.get(value));
}

function languagePath(page, targetLang, ctx) {
  const target = languageForValue(targetLang, ctx);
  const listingPath = listings.languagePath(page, target);
  if (listingPath !== undefined) return listingPath;

  let targetPath;
  if (isNotFoundPage(page)) {
    targetPath = notFoundPath(target, ctx);
  } else if (normalizeLanguage(target) === pageLanguage(page, ctx)) {
    targetPath = routeToUrlPath(page && page.path);
  } else if (isPostPage(page)) {
    const translated = findPostTranslation(page, target, ctx);
    targetPath = translated ? routeToUrlPath(translated.path) : '';
  } else {
    const route = routeWithoutLanguage(page && page.path, ctx);
    targetPath = localizedPath(route ? `/${route}/` : '/', target, ctx);
  }
  return routeExists(targetPath) ? targetPath : '';
}

function listingIndexPath(kind, lang, ctx) {
  const field = kind === 'archive' ? 'archive_dir' : 'tag_dir';
  const base = directory(ctx.config[field] ?? (kind === 'archive' ? 'archives' : 'tags'), field);
  const target = routeToUrlPath(`${languagePrefix(lang, ctx)}${base}`);
  return routeExists(target) ? target : '';
}

function postsForLanguage(collection, lang, ctx) {
  const targetLang = normalizeLanguage(lang || pageLanguageValue(ctx.page, ctx), defaultLanguage(ctx));
  const posts = toArray(collection || ctx.site.posts).filter(post =>
    pageLanguage(post, ctx) === targetLang
  );

  return sortByDateDesc(posts);
}

function languageShortLabel(lang) {
  const normalized = normalizeLanguage(lang);
  if (normalized === 'en') return 'EN';
  if (normalized.startsWith('zh')) return 'ZH';
  return String(lang || '').toUpperCase();
}

function languageLongLabel(lang) {
  const normalized = normalizeLanguage(lang);
  if (normalized === 'en') return 'English';
  if (normalized.startsWith('zh')) return '中文';
  return String(lang || '');
}

function localizedValue(value, lang, ctx) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value || '';

  const targetLang = normalizeLanguage(lang, defaultLanguage(ctx));
  const defaultLang = normalizeLanguage(defaultLanguage(ctx));
  const keys = Object.keys(value);
  const targetKey = keys.find(key => normalizeLanguage(key) === targetLang);
  const defaultKey = keys.find(key => normalizeLanguage(key) === defaultLang);

  return value[targetKey] || value[defaultKey] || value[keys[0]] || '';
}

function siteCopy(key, lang, ctx) {
  const theme = ctx.theme || {};
  const site = theme.site || (theme.config && theme.config.site) || {};
  return localizedValue(site[key], lang || pageLanguageValue(ctx.page, ctx), ctx);
}

function normalizeTermName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function collectionTermSet(collection) {
  return new Set(
    toArray(collection)
      .map(item => normalizeTermName(item.name))
      .filter(Boolean)
  );
}

function sharedTerms(a, b) {
  return Array.from(a).filter(term => b.has(term));
}

function documentFrequency(posts, field) {
  const frequency = new Map();

  posts.forEach(post => {
    collectionTermSet(post[field]).forEach(term => {
      frequency.set(term, (frequency.get(term) || 0) + 1);
    });
  });

  return frequency;
}

function termWeight(term, frequency, total) {
  const termCount = frequency.get(term) || 1;
  return 1 + Math.log((total + 1) / termCount);
}

function weightedSharedTermScore(a, b, frequency, total, weight) {
  return sharedTerms(a, b).reduce((score, term) => {
    return score + termWeight(term, frequency, total) * weight;
  }, 0);
}

function addTextTerm(terms, term) {
  const normalized = normalizeTermName(term);
  if (!normalized || normalized.length < 2) return;
  if (/^\d+$/.test(normalized)) return;
  terms.add(normalized);
}

function postTextTerms(post) {
  const text = stripHTML([post.title, post.description, post.excerpt].filter(Boolean).join(' ')).toLowerCase();
  const terms = new Set();
  const wordTokens = text.match(/[\p{L}\p{N}][\p{L}\p{N}+#.-]{1,}/gu) || [];
  const cjkRuns = text.match(/[一-龥぀-ゟ゠-ヿ가-힯]{2,}/g) || [];

  wordTokens.forEach(token => addTextTerm(terms, token));
  cjkRuns.forEach(run => {
    const chars = Array.from(run);
    if (chars.length === 2) {
      addTextTerm(terms, run);
      return;
    }

    for (let index = 0; index < chars.length - 1; index += 1) {
      addTextTerm(terms, `${chars[index]}${chars[index + 1]}`);
    }
  });

  return terms;
}

function relatedPostSignals(post) {
  return {
    post,
    tags: collectionTermSet(post.tags),
    categories: collectionTermSet(post.categories),
    textTerms: postTextTerms(post)
  };
}

function textOverlapScore(a, b) {
  return Math.min(sharedTerms(a, b).length * RELATED_TEXT_WEIGHT, RELATED_TEXT_SCORE_CAP);
}

function firstCategory(post) {
  return toArray(post && post.categories)[0] || null;
}

function postListSummary(post, length) {
  if (!post) return '';
  const summary = post.description || post.excerpt;
  if (!summary) return '';

  const configuredLength = Number(length);
  const summaryLength = Number.isFinite(configuredLength) && configuredLength > 0
    ? Math.floor(configuredLength)
    : DEFAULT_EXCERPT_LENGTH;

  return stripHTML(String(summary)).trim().substring(0, summaryLength);
}

function dateValue(value) {
  if (!value) return 0;
  if (typeof value.valueOf === 'function') return value.valueOf();
  return Number(value) || 0;
}

function archiveMonthValue(month, lang) {
  const monthNumber = Number(month);
  if (String(lang || '').toLowerCase().startsWith('zh')) return monthNumber;
  return String(monthNumber).padStart(2, '0');
}

function compareFeedPosts(a, b, orderBy) {
  const order = String(orderBy || '-date');
  const descending = order.charAt(0) !== '+';
  const field = order.replace(/^[-+]/, '') || 'date';
  const aValue = dateValue(a[field]);
  const bValue = dateValue(b[field]);

  return descending ? bValue - aValue : aValue - bValue;
}

function cdata(value) {
  return String(value || '').replace(/]]>/g, ']]]]><![CDATA[>');
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function feedDate(value) {
  if (!value) return new Date(0).toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.toISOString === 'function') return value.toISOString();
  return new Date(value).toISOString();
}

function urlContext(value, ctx) {
  if (String(value).replace(/^\/+/, '') !== '404.html') return ctx;
  return {
    path: ctx.path,
    config: { ...ctx.config, pretty_urls: { ...ctx.config.pretty_urls, trailing_html: true } }
  };
}

function fullUrlFor(value, ctx) {
  return encodeURL(full_url_for.call(urlContext(value, ctx), value));
}

function feedItemDescription(post, feedConfig) {
  if (post.description) return post.description;
  if (post.intro) return post.intro;
  if (post.excerpt) return post.excerpt;
  if (!post.content) return '';

  const shortContent = stripHTML(post.content).substring(0, feedConfig.content_limit || DEFAULT_FEED_CONTENT_LIMIT);
  if (feedConfig.content_limit_delim) {
    const delimiterPosition = shortContent.lastIndexOf(feedConfig.content_limit_delim);
    if (delimiterPosition > -1) return shortContent.substring(0, delimiterPosition);
  }

  return shortContent;
}

function feedItemContent(post, feedConfig) {
  if (!feedConfig.content || !post.content) return '';
  return post.content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function feedItemCategories(post, ctx) {
  return [
    ...toArray(post.categories),
    ...toArray(post.tags)
  ].filter(item => item && item.name).map(item => ({
    name: item.name,
    scheme: item.permalink ? fullUrlFor(item.permalink, ctx) : ''
  }));
}

function feedAuthor(ctx, indent) {
  const author = ctx.config.author;
  const email = ctx.config.email;
  const name = author || email;
  if (!name) return '';

  const space = indent || '  ';
  const lines = [
    `${space}<author>`,
    `${space}  <name>${escapeXml(name)}</name>`
  ];

  if (email) lines.push(`${space}  <email>${escapeXml(email)}</email>`);

  lines.push(`${space}</author>`);
  return lines.join('\n');
}

function renderFeedEntry(post, feedConfig, ctx) {
  const link = escapeXml(fullUrlFor(post.permalink, ctx));
  const updated = feedDate(post.updated || post.date);
  const content = feedItemContent(post, feedConfig);
  const description = feedItemDescription(post, feedConfig);
  const categories = feedItemCategories(post, ctx)
    .map(category => {
      const scheme = category.scheme ? ` scheme="${escapeXml(category.scheme)}"` : '';
      return `    <category term="${escapeXml(category.name)}"${scheme}/>`;
    })
    .join('\n');

  return [
    '  <entry>',
    feedAuthor(ctx, '    '),
    categories,
    content ? `    <content type="html">\n      <![CDATA[${cdata(content)}]]>\n    </content>` : '',
    `    <id>${link}</id>`,
    `    <link href="${link}"/>`,
    `    <published>${feedDate(post.date)}</published>`,
    description ? `    <summary>${escapeXml(description)}</summary>` : '',
    `    <title>${escapeXml(post.title)}</title>`,
    `    <updated>${updated}</updated>`,
    '  </entry>'
  ].filter(Boolean).join('\n');
}

function renderAtomFeed(posts, lang, ctx) {
  const feedConfig = configuredFeed(ctx);
  const feedPath = atomFeedPath(lang, ctx);
  const homepagePath = homePath(lang, ctx);
  const feedUrl = escapeXml(fullUrlFor(feedPath, ctx));
  const homeUrl = escapeXml(fullUrlFor(homepagePath, ctx));
  const updatedPost = posts[0] || {};
  const updated = feedDate(updatedPost.updated || updatedPost.date || new Date());
  const description = siteCopy('description', lang, ctx) || siteCopy('subtitle', lang, ctx) ||
    ctx.config.subtitle || ctx.config.description || '';
  let icon = '';
  if (feedConfig.icon) {
    icon = fullUrlFor(feedConfig.icon, ctx);
  } else if (ctx.config.email) {
    icon = gravatar(ctx.config.email);
  }
  const hub = feedConfig.hub ? `  <link href="${escapeXml(fullUrlFor(feedConfig.hub, ctx))}" rel="hub"/>` : '';
  const currentYear = new Date().getFullYear();
  const rights = ctx.config.author ? `All rights reserved ${currentYear}, ${ctx.config.author}` : '';

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${escapeXml(lang)}">`,
    feedAuthor(ctx, '  '),
    '  <generator uri="https://hexo.io/">Hexo</generator>',
    icon ? `  <icon>${escapeXml(icon)}</icon>` : '',
    `  <id>${homeUrl}</id>`,
    `  <link href="${homeUrl}" rel="alternate"/>`,
    `  <link href="${feedUrl}" rel="self"/>`,
    hub,
    rights ? `  <rights>${escapeXml(rights)}</rights>` : '',
    description ? `  <subtitle>${escapeXml(description)}</subtitle>` : '',
    `  <title>${escapeXml(ctx.config.title)}</title>`,
    `  <updated>${updated}</updated>`,
    posts.map(post => renderFeedEntry(post, feedConfig, ctx)).join('\n'),
    '</feed>'
  ].filter(Boolean).join('\n');
}

function feedPostsForLanguage(locals, lang, ctx) {
  const feedConfig = configuredFeed(ctx);
  const posts = postsForLanguage(locals.posts, lang, ctx)
    .filter(post => post.published !== false && post.draft !== true)
    .sort((a, b) => compareFeedPosts(a, b, feedConfig.order_by));

  return feedConfig.limit ? posts.slice(0, feedConfig.limit) : posts;
}

function obsidianCalloutEnabled(ctx) {
  const config = ctx.config.obsidian_callout;
  return Boolean(config && config.enabled);
}

function photoswipeEnabled(ctx) {
  const config = ctx.config.photoswipe;
  return Boolean(config && config.enabled);
}

hexo.extend.filter.register('post_permalink', function(data) {
  if (!data || typeof data !== 'object') return data;

  data.post_root = postRootForLanguage(data.lang);
  return data;
}, 5);

hexo.extend.filter.register('after_generate', function() {
  const assets = [...BASE_VERSIONED_THEME_ASSETS];
  if (obsidianCalloutEnabled(hexo)) {
    assets.push(...OBSIDIAN_CALLOUT_ASSETS);
  }
  if (photoswipeEnabled(hexo)) {
    assets.push(...PHOTOSWIPE_ASSETS);
  }

  assets.forEach(registerVersionedThemeAsset);
});

hexo.extend.generator.register('atom', function(locals) {
  const feedConfig = configuredFeed(hexo);
  if (!atomFeedEnabled(feedConfig)) return [];

  return configuredLanguages(hexo).map(lang => {
    const path = atomFeedPath(lang, hexo).replace(/^\/+/, '');
    const posts = feedPostsForLanguage(locals, lang, hexo);

    return {
      path,
      data: renderAtomFeed(posts, lang, hexo)
    };
  });
});

hexo.extend.helper.register('configured_languages', function() {
  return configuredLanguages(this);
});

hexo.extend.helper.register('page_lang', function(page) {
  return pageLanguageValue(page, this);
});

hexo.extend.helper.register('is_home_page', function(page) {
  return isHomePage(page, this);
});

hexo.extend.helper.register('language_short_label', function(lang) {
  return languageShortLabel(lang);
});

hexo.extend.helper.register('language_long_label', function(lang) {
  return languageLongLabel(lang);
});

hexo.extend.helper.register('localized_value', function(value, lang) {
  return localizedValue(value, lang || pageLanguageValue(this.page, this), this);
});

hexo.extend.helper.register('site_copy', function(key, fallback) {
  return siteCopy(key, pageLanguageValue(this.page, this), this) || fallback || '';
});

hexo.extend.helper.register('localized_path', function(path, lang) {
  return localizedPath(path, lang || pageLanguageValue(this.page, this), this);
});

hexo.extend.helper.register('home_path', function(lang) {
  return homePath(lang || pageLanguageValue(this.page, this), this);
});

hexo.extend.helper.register('archive_path', function(lang) {
  return listingIndexPath('archive', lang || pageLanguageValue(this.page, this), this);
});

hexo.extend.helper.register('tag_index_path', function(lang) {
  return listingIndexPath('tag', lang || pageLanguageValue(this.page, this), this);
});

hexo.extend.helper.register('navigation_path', function(value, lang, name) {
  const target = lang || pageLanguageValue(this.page, this);
  if (isExternalPath(value)) return value;
  const route = routeWithoutLanguage(value, this);
  if (!route) return homePath(target, this);
  if (route === cleanRoutePath(this.config.archive_dir ?? 'archives') || (name === 'menu.archives' && route === 'archives')) return listingIndexPath('archive', target, this);
  if (route === cleanRoutePath(this.config.tag_dir ?? 'tags')) return listingIndexPath('tag', target, this);
  return localizedPath(value, target, this);
});

hexo.extend.helper.register('canonical_url', function(page) {
  const target = isNotFoundPage(page) && isDefaultLanguage(pageLanguageValue(page, this), this)
    ? '/404.html'
    : routeToUrlPath(page.path);
  return fullUrlFor(target, this);
});

hexo.extend.helper.register('pagination_pages', function(page) {
  return listings.paginationPages(page);
});

hexo.extend.helper.register('href_for_path', function(value) {
  const pathValue = String(value || '');
  return url_for.call(urlContext(pathValue, this), pathValue);
});

hexo.extend.helper.register('absolute_url', function(value) {
  return fullUrlFor(value, this);
});

hexo.extend.helper.register('normalize_route_path', function(value) {
  return cleanRoutePath(value);
});

hexo.extend.helper.register('versioned_asset', function(assetPath) {
  return this.url_for(`/${versionedThemeAssetRoute(assetPath)}`);
});

hexo.extend.helper.register('obsidian_callout_enabled', function() {
  return obsidianCalloutEnabled(hexo);
});

hexo.extend.helper.register('photoswipe_enabled', function() {
  return photoswipeEnabled(hexo);
});

hexo.extend.helper.register('feed_path', function(lang) {
  if (!atomFeedEnabled(configuredFeed(this))) return '';
  return atomFeedPath(lang || pageLanguageValue(this.page, this), this);
});

hexo.extend.helper.register('language_path', function(page, lang) {
  return languagePath(page, lang, this);
});

hexo.extend.helper.register('alternate_language_paths', function(page) {
  const paths = listings.alternatePaths(page);
  if (paths !== undefined) return paths;
  return configuredLanguages(this)
    .map(lang => ({ lang, path: languagePath(page, lang, this) }))
    .filter(item => item.path);
});

hexo.extend.helper.register('is_external_url', function(value) {
  return /^(?:https?:)?\/\//i.test(String(value || ''));
});

hexo.extend.helper.register('normalize_link_url', function(value) {
  const linkUrl = String(value || '').trim();
  if (!linkUrl || isExternalPath(linkUrl)) return linkUrl;
  return this.url_for(linkUrl);
});

hexo.extend.helper.register('archive_month_value', function(month) {
  return archiveMonthValue(month, pageLanguageValue(this.page, this));
});

hexo.extend.helper.register('archive_page_title', function() {
  const page = this.page || {};
  const year = Number(page.year) || 0;
  const month = Number(page.month) || 0;
  const day = Number(page.day) || 0;
  const lang = pageLanguageValue(page, this);

  if (year && month && day) return this.__('archive.day_heading', year, archiveMonthValue(month, lang), archiveMonthValue(day, lang));
  if (year && month) return this.__('archive.month_heading', year, archiveMonthValue(month, lang));
  if (year) return this.__('archive.year', year);
  return this.__('archive.title');
});

// A heading nested in a callout or a raw HTML wrapper has to stay inside that
// wrapper, so only top-level headings mark section boundaries.
function topLevelHeadingOffsets(html) {
  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
  const offsets = new Set();
  let depth = 0;
  let match;

  while ((match = tagPattern.exec(html)) !== null) {
    const name = match[2].toLowerCase();

    if (match[1]) {
      depth = Math.max(0, depth - 1);
    } else if (!match[3] && !HTML_VOID_TAGS.has(name)) {
      if (name !== 'h2' || depth > 0) {
        depth += 1;
      } else {
        offsets.add(match.index);
        const closeIndex = html.indexOf('</h2>', tagPattern.lastIndex);
        if (closeIndex !== -1) tagPattern.lastIndex = closeIndex + '</h2>'.length;
      }
    }
  }

  return offsets;
}

hexo.extend.helper.register('about_section_grid', function(content) {
  const contentHtml = String(content || '').trim();
  if (!contentHtml || contentHtml.includes('about-section-grid')) return contentHtml;

  const headingPattern = /<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi;
  const headerLinkPattern = /<a\b[^>]*class="[^"]*\bheaderlink\b[^"]*"[^>]*><\/a>/gi;
  const topLevelOffsets = topLevelHeadingOffsets(contentHtml);
  const headings = [];
  let match;

  while ((match = headingPattern.exec(contentHtml)) !== null) {
    if (!topLevelOffsets.has(match.index)) continue;

    headings.push({
      startIndex: match.index,
      endIndex: headingPattern.lastIndex,
      attributes: match[1],
      innerHtml: match[2]
    });
  }

  if (headings.length === 0) return contentHtml;

  const leadingHtml = contentHtml.slice(0, headings[0].startIndex).trim();
  const sections = headings.map((heading, index) => {
    const nextHeading = headings[index + 1];
    const sectionEnd = nextHeading ? nextHeading.startIndex : contentHtml.length;
    const sectionBody = contentHtml.slice(heading.endIndex, sectionEnd).trim();
    const label = String(index + 1).padStart(2, '0');

    const headingInnerHtml = heading.innerHtml.replace(headerLinkPattern, '');

    return [
      '<section class="about-section">',
      '  <div class="about-section-heading">',
      `    <p class="about-section-label">${label}</p>`,
      `    <h2${heading.attributes}>${headingInnerHtml}</h2>`,
      '  </div>',
      sectionBody,
      '</section>'
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  return [
    leadingHtml,
    `<div class="about-section-grid">\n${sections}\n</div>`
  ].filter(Boolean).join('\n');
});

hexo.extend.helper.register('posts_for_language', function(collection, lang) {
  return postsForLanguage(collection, lang || pageLanguageValue(this.page, this), this);
});

hexo.extend.helper.register('first_category', function(post) {
  return firstCategory(post);
});

hexo.extend.helper.register('post_list_summary', function(post, length) {
  const excerptLength = length || (this.theme && this.theme.excerpt_length) || DEFAULT_EXCERPT_LENGTH;
  return postListSummary(post, excerptLength);
});

hexo.extend.helper.register('post_neighbors', function(post) {
  if (!post) return { prev: null, next: null };

  const posts = postsForLanguage(this.site.posts, pageLanguageValue(post, this), this);
  const index = posts.findIndex(item => item._id === post._id);
  if (index === -1) return { prev: null, next: null };

  return {
    prev: index < posts.length - 1 ? posts[index + 1] : null,
    next: index > 0 ? posts[index - 1] : null
  };
});

hexo.extend.helper.register('reading_time', function(content) {
  if (!content) return 0;

  const text = stripHTML(content);
  const cjkChars = (text.match(CJK_CHARACTER_PATTERN) || []).length;
  const latinWords = text.replace(CJK_CHARACTER_PATTERN, ' ')
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(cjkChars / CJK_CHARS_PER_MINUTE + latinWords / LATIN_WORDS_PER_MINUTE));
});

hexo.extend.helper.register('related_posts', function(post) {
  if (!post) return [];

  const config = this.theme.related_posts || {};
  if (!config.enable) return [];

  const configuredCount = Number(config.count);
  let count = DEFAULT_RELATED_POST_COUNT;
  if (Number.isFinite(configuredCount) && configuredCount > 0) {
    count = Math.floor(configuredCount);
  }

  const currentLang = pageLanguage(post, this);
  const currentPost = relatedPostSignals(post);
  const candidates = postsForLanguage(this.site.posts, currentLang, this)
    .filter(candidate => candidate._id !== post._id)
    .map(relatedPostSignals);
  const scoringPosts = [post, ...candidates.map(candidate => candidate.post)];
  const totalPosts = scoringPosts.length;
  const tagFrequency = documentFrequency(scoringPosts, 'tags');
  const categoryFrequency = documentFrequency(scoringPosts, 'categories');

  return candidates
    .map(candidate => {
      const taxonomyScore =
        weightedSharedTermScore(currentPost.tags, candidate.tags, tagFrequency, totalPosts, RELATED_TAG_WEIGHT) +
        weightedSharedTermScore(currentPost.categories, candidate.categories, categoryFrequency, totalPosts, RELATED_CATEGORY_WEIGHT);

      return {
        post: candidate.post,
        score: taxonomyScore + textOverlapScore(currentPost.textTerms, candidate.textTerms),
        taxonomyScore
      };
    })
    .filter(item => item.taxonomyScore > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (dateValue(b.post.date) !== dateValue(a.post.date)) return dateValue(b.post.date) - dateValue(a.post.date);
      return String(a.post.title || '').localeCompare(String(b.post.title || ''));
    })
    .slice(0, count)
    .map(item => item.post);
});
