'use strict';

const pagination = require('hexo-pagination');
const {
  configuredLanguages,
  directory,
  homePath,
  languagePrefix,
  normalizeLanguage,
  pageLanguageValue,
  routeToUrlPath
} = require('./language');

const registries = new WeakMap();
const GENERATOR_NAMES = ['index', 'archive', 'category', 'tag'];

function generatorConfig(config, name) {
  const options = config[`${name}_generator`] === undefined ? {} : config[`${name}_generator`];
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError(`[ZhiMo] ${name}_generator must be a configuration object.`);
  }
  const globalPerPage = config.per_page === undefined ? 10 : config.per_page;
  const perPage = options.per_page === undefined ? globalPerPage : options.per_page;
  if (!Number.isSafeInteger(perPage) || perPage < 0) {
    throw new TypeError(`[ZhiMo] ${name}_generator.per_page must be a non-negative integer.`);
  }
  const orderBy = options.order_by === undefined ? '-date' : options.order_by;
  const validOrder = typeof orderBy === 'string'
    ? orderBy.trim().length > 0
    : orderBy && !Array.isArray(orderBy) && Object.keys(orderBy).length > 0 &&
      Object.values(orderBy).every(order => order === 1 || order === -1);
  if (!validOrder) {
    throw new TypeError(`[ZhiMo] ${name}_generator.order_by must name a sort field or map fields to 1 or -1.`);
  }
  return { ...options, perPage, orderBy };
}

function dateGroups(posts, options, timezone) {
  const groups = new Map();
  posts.forEach(post => {
    const date = timezone ? post.date.clone().tz(timezone) : post.date;
    const year = date.year();
    const month = date.month() + 1;
    const day = date.date();
    const monthPart = String(month).padStart(2, '0');
    const dayPart = String(day).padStart(2, '0');
    const dates = [[`${year}/`, { year }]];
    if (options.monthly !== false) dates.push([`${year}/${monthPart}/`, { year, month }]);
    if (options.daily === true) dates.push([`${year}/${monthPart}/${dayPart}/`, { year, month, day }]);
    for (const [path, date] of dates) {
      if (!groups.has(path)) groups.set(path, { path, date, posts: [] });
      groups.get(path).posts.push(post);
    }
  });
  return groups.values();
}

function createPlan(hexo, locals) {
  const { config } = hexo;
  const languages = configuredLanguages(hexo);
  const { Query } = hexo.model('Post');
  const routes = Object.fromEntries(GENERATOR_NAMES.map(name => [name, []]));
  const pages = new Map();
  const collections = new Map();
  const alternates = new Map();
  const postLanguages = new Map();
  const translationIds = new Set();
  const taxonomyMembers = { categories: new Map(), tags: new Map() };
  const paginationDir = directory(config.pagination_dir ?? 'page', 'pagination_dir');
  if (!paginationDir) throw new TypeError('[ZhiMo] pagination_dir cannot be empty.');

  locals.posts.forEach(post => {
    const lang = pageLanguageValue(post, hexo);
    if (!languages.includes(lang)) {
      throw new Error(`[ZhiMo] Post "${post.source}" uses unconfigured language "${lang}".`);
    }
    const translationId = JSON.stringify([lang, post.slug]);
    if (languages.length > 1 && translationIds.has(translationId)) {
      throw new Error(`[ZhiMo] More than one ${lang} post uses slug "${post.slug}"; translation links would be ambiguous.`);
    }
    translationIds.add(translationId);
    postLanguages.set(post._id, lang);
    for (const field of ['categories', 'tags']) {
      post[field].forEach(term => {
        if (!taxonomyMembers[field].has(term._id)) taxonomyMembers[field].set(term._id, { term, posts: [] });
        taxonomyMembers[field].get(term._id).posts.push(post);
      });
    }
  });

  const postsBySlug = new Map();
  locals.posts.forEach(post => {
    const lang = postLanguages.get(post._id);
    if (!postsBySlug.has(post.slug)) postsBySlug.set(post.slug, new Map());
    postsBySlug.get(post.slug).set(lang, post);
  });

  function partition(posts) {
    const groups = new Map(languages.map(lang => [lang, []]));
    posts.forEach(post => {
      const lang = postLanguages.get(post._id);
      if (!lang) throw new Error(`[ZhiMo] A taxonomy references a post outside locals.posts: ${post.source}`);
      groups.get(lang).push(post);
    });
    return new Map(Array.from(groups, ([lang, posts]) => [lang, new Query(posts)]));
  }

  function addSeries(generator, key, lang, base, posts, options) {
    const listing = { key, kind: options.kind || generator };
    const generated = pagination(base, posts, {
      perPage: posts.length ? options.perPage : 0,
      format: `${paginationDir}%d/`,
      layout: options.layout,
      data: {
        ...options.data,
        lang,
        listing,
        total_posts: posts.length
      }
    });
    if (!collections.has(key)) collections.set(key, new Map());
    collections.get(key).set(normalizeLanguage(lang), generated);

    for (const route of generated) {
      const path = hexo.route.format(route.path);
      if (pages.has(path)) {
        throw new Error(`[ZhiMo] List routes collide at "${path}". Give home, archive and taxonomy pages distinct paths.`);
      }
      const entry = { url: routeToUrlPath(path), data: route.data };
      pages.set(path, entry);
      entry.alternates = [];
      if (languages.length > 1) {
        const contentKey = route.data.current === 1
          ? 'index'
          : route.data.posts.map(post => post.slug).sort();
        const alternateKey = JSON.stringify([key, contentKey]);
        if (!alternates.has(alternateKey)) alternates.set(alternateKey, []);
        const group = alternates.get(alternateKey);
        if (group.some(item => item.data.lang === lang)) {
          throw new Error(`[ZhiMo] Ambiguous pagination translation at "${path}".`);
        }
        group.push(entry);
        entry.alternates = group;
      }
      routes[generator].push(route);
    }
  }

  // Two single-language taxonomy terms share one collection when the
  // translations of each term's posts stay within the other term.
  function collectionKeyPaths(field, termPaths) {
    const members = taxonomyMembers[field];
    const termLanguages = new Map();
    const singleLanguageTerms = new Set();
    for (const [termId, entry] of members) {
      const langs = new Set(entry.posts.map(post => postLanguages.get(post._id)));
      if (langs.size === 1) {
        singleLanguageTerms.add(termId);
        termLanguages.set(termId, langs.values().next().value);
      }
    }

    const candidates = new Map();
    for (const termId of singleLanguageTerms) {
      const perLanguage = new Map();
      for (const post of members.get(termId).posts) {
        for (const [otherLang, translated] of postsBySlug.get(post.slug)) {
          if (otherLang === postLanguages.get(post._id)) continue;
          const terms = new Set();
          translated[field].forEach(term => {
            if (singleLanguageTerms.has(term._id)) terms.add(term._id);
          });
          if (!perLanguage.has(otherLang)) {
            perLanguage.set(otherLang, terms);
          } else {
            const intersection = perLanguage.get(otherLang);
            for (const existing of Array.from(intersection)) {
              if (!terms.has(existing)) intersection.delete(existing);
            }
          }
        }
      }
      candidates.set(termId, perLanguage);
    }

    const parent = new Map();
    const find = id => {
      let root = id;
      while (parent.get(root) !== root) root = parent.get(root);
      while (parent.get(id) !== root) {
        const next = parent.get(id);
        parent.set(id, root);
        id = next;
      }
      return root;
    };
    const union = (a, b) => {
      parent.set(find(a), find(b));
    };

    for (const termId of singleLanguageTerms) parent.set(termId, termId);
    for (const [termId, perLanguage] of candidates) {
      const lang = termLanguages.get(termId);
      for (const [otherLang, partnerIds] of perLanguage) {
        for (const partnerId of partnerIds) {
          if (candidates.get(partnerId).get(lang)?.has(termId)) union(termId, partnerId);
        }
      }
    }

    const groups = new Map();
    for (const termId of parent.keys()) {
      const root = find(termId);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(termId);
    }

    const paths = new Map();
    for (const termId of members.keys()) paths.set(termId, termPaths.get(termId));
    for (const termIds of groups.values()) {
      const langs = new Set(termIds.map(termId => termLanguages.get(termId)));
      const ambiguous = langs.size !== termIds.length;
      const representative = ambiguous ? null : termIds.map(id => termPaths.get(id)).sort()[0];
      for (const termId of termIds) {
        if (!ambiguous) paths.set(termId, representative);
      }
    }
    return paths;
  }

  const languagePosts = partition(locals.posts);
  const taxonomies = new Map(languages.map(lang => [lang, { categories: [], tags: [] }]));

  for (const [generator, field] of [['category', 'categories'], ['tag', 'tags']]) {
    const options = generatorConfig(config, generator);
    const termPaths = new Map(Array.from(taxonomyMembers[field], ([termId, entry]) =>
      [termId, directory(entry.term.path, `${generator}.path`)]));
    const collectionPaths = collectionKeyPaths(field, termPaths);
    for (const { term, posts: members } of taxonomyMembers[field].values()) {
      const termPath = termPaths.get(term._id);
      for (const [lang, posts] of partition(members)) {
        if (!posts.length) continue;
        taxonomies.get(lang)[field].push({ name: term.name, path: termPath, count: posts.length });
        addSeries(generator, `${generator}:${collectionPaths.get(term._id)}`, lang, `${languagePrefix(lang, hexo)}${termPath}`, posts.sort(options.orderBy), {
          perPage: options.perPage,
          layout: [generator, 'archive', 'index'],
          data: { [generator]: term.name }
        });
      }
    }
  }

  for (const terms of taxonomies.values()) {
    for (const field of ['categories', 'tags']) {
      terms[field].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }
  }

  const archive = generatorConfig(config, 'archive');
  const archiveDir = directory(config.archive_dir ?? 'archives', 'archive_dir');
  const tagDir = directory(config.tag_dir ?? 'tags', 'tag_dir');
  const primarySort = typeof archive.orderBy === 'string'
    ? archive.orderBy.split(/\s+/)[0].replace(/^[-+]/, '')
    : Object.keys(archive.orderBy)[0];

  for (const [lang, posts] of languagePosts) {
    addSeries('index', 'home', lang, homePath(lang, hexo).slice(1), posts.sort('-date'), {
      perPage: 0,
      layout: 'index',
      data: { __index: true }
    });

    if (config.tag_generator?.enable_index_page !== false) {
      addSeries('tag', 'tag-index', lang, `${languagePrefix(lang, hexo)}${tagDir}`, posts, {
        kind: 'tag-index',
        perPage: 0,
        layout: 'tags',
        data: { tag_index: true, terms: taxonomies.get(lang).tags }
      });
    }

    if (archive.enabled === false) continue;
    const sorted = posts.sort(archive.orderBy);
    const base = `${languagePrefix(lang, hexo)}${archiveDir}`;
    const options = {
      perPage: archive.perPage,
      layout: ['archive', 'index'],
      data: { archive: true, archive_chronological: primarySort === 'date', taxonomies: taxonomies.get(lang) }
    };
    addSeries('archive', 'archive', lang, base, sorted, options);
    if (archive.yearly === false) continue;
    for (const group of dateGroups(sorted, archive, config.timezone)) {
      addSeries('archive', `archive:${group.path}`, lang, `${base}${group.path}`, new Query(group.posts), {
        ...options,
        data: { ...options.data, ...group.date }
      });
    }
  }

  return { routes, pages, collections };
}

function getListings(hexo) {
  if (registries.has(hexo)) return registries.get(hexo);
  let plan;

  function pageEntry(page) {
    return plan?.pages.get(hexo.route.format(page.path || ''));
  }

  const registry = {
    reset() {
      plan = undefined;
    },
    generate(name, locals) {
      if (!plan) plan = createPlan(hexo, locals);
      return plan.routes[name];
    },
    collectionPath(key, lang) {
      const routes = plan?.collections.get(key)?.get(normalizeLanguage(lang));
      return routes ? routeToUrlPath(hexo.route.format(routes[0].path)) : '';
    },
    languagePath(page, lang) {
      const entry = pageEntry(page);
      if (!entry) return undefined;
      return registry.collectionPath(entry.data.listing.key, lang);
    },
    alternatePaths(page) {
      const entry = pageEntry(page);
      if (!entry) return undefined;
      return entry.alternates.length > 1
        ? entry.alternates.map(item => ({ lang: item.data.lang, path: item.url }))
        : [];
    },
    paginationPages(page) {
      const entry = pageEntry(page);
      if (!entry) throw new Error('[ZhiMo] Pagination requires a generated list page.');
      const { current, total, lang, listing } = entry.data;
      const series = plan.collections.get(listing.key).get(normalizeLanguage(lang));
      const numbers = new Set([1, total]);
      if (total <= 5) {
        for (let number = 1; number <= total; number++) numbers.add(number);
      } else {
        for (let number = Math.max(1, current - 1); number <= Math.min(total, current + 1); number++) numbers.add(number);
      }
      const items = [];
      let previous = 0;
      for (const number of Array.from(numbers).sort((a, b) => a - b)) {
        if (number - previous > 1) items.push({ gap: true });
        items.push({ number, current: number === current, path: routeToUrlPath(hexo.route.format(series[number - 1].path)) });
        previous = number;
      }
      return items;
    },
    hasPath(path) {
      return Boolean(plan?.pages.has(hexo.route.format(path)));
    }
  };
  registries.set(hexo, registry);
  return registry;
}

module.exports = { GENERATOR_NAMES, getListings };
