# ZhiMo Configuration

[English](configuration.md) · [README](../README.md) · [Contributing](CONTRIBUTING.md)

## Where Options Live

Theme defaults are in the theme's own `_config.yml`. The Hexo site overrides them from two places, and `theme_config` takes precedence over `_config.zhimo.yml`:

```yaml
# _config.yml at the site root
theme_config:
  site:
    subtitle: Notes on systems and software
  latest_count: 8
```

```yaml
# _config.zhimo.yml at the site root
site:
  subtitle: Notes on systems and software
latest_count: 8
```

In the sections below, snippets of theme options list the defaults, so a site only writes the values it changes.

## Navigation and Contact

```yaml
menu:
  menu.home: /
  menu.archives: /archives/
  menu.friends: /friends/
  menu.about: /about/
social:
  RSS: /atom.xml
  # GitHub: https://github.com/your-name
  # Email: mailto:you@example.com
```

The keys of `menu` are UI string keys from `languages/*.yml` and the values are paths. Entries can be added, removed or reordered, and a new entry needs a matching key in the language files first.

The entries of `social` are shown in the footer, on the about page and on the friends page. `RSS` takes its link from the feed path of the current page language, and other keys take a full URL or a `mailto:` address. `Email` also becomes the contact link on the friends page.

## Site Copy and Home Page

```yaml
site:
  subtitle:
  description:
home:
  cover_kicker:
    zh-CN: 写作与记录
    en: Writing and notes
featured_count: 3
latest_count: 5
excerpt_length: 160
```

`site.subtitle`, `site.description` and `home.cover_kicker` are the site subtitle, the site description and the label above the home cover title. Each takes a plain string or a value keyed by language.

`latest_count` and `featured_count` are the number of posts in the latest list and the featured list on the home page, and `excerpt_length` is the summary length used by the lists.

The featured block is skipped when no post sets `featured: true`, and posts already listed as latest are not repeated there.

## Footer

```yaml
footer:
  show_powered: true
  records: []
```

`footer.show_powered` is the theme attribution line. `footer.records` holds compliance entries such as ICP or public security filings, and an empty array renders nothing.

Record example:

```yaml
footer:
  records:
    - text: 京ICP备00000000号-1
      url: https://beian.miit.gov.cn/
      aria_label:
        zh-CN: ICP备案号：京ICP备00000000号-1
        en: "ICP filing: 京ICP备00000000号-1"
    - text: 京公网安备 00000000000000号
      url: https://beian.mps.gov.cn/#/query/webSearch?code=00000000000000
      icon: /images/beian.png
      icon_alt:
        zh-CN: 公安备案图标
        en: Public security registration icon
```

A record takes `text` and the optional `url`, `icon`, `icon_alt` and `aria_label`. `text`, `icon_alt` and `aria_label` accept a plain string or a language-keyed object.

## Article Page

```yaml
toc:
  enable: true
  min_depth: 1
  max_depth: 3
  max_items: 30
  list_number: false
related_posts:
  enable: true
  count: 3
highlight:
  copy_button: true
```

`toc.enable` turns the article table of contents on or off. `toc.min_depth` and `toc.max_depth` are the heading levels it lists, `toc.max_items` is the entry limit and `toc.list_number` numbers the entries.

`related_posts.enable` turns recommendations on or off. They are picked from shared categories and tags within the post language, and `related_posts.count` sets how many are shown. `highlight.copy_button` is the copy button on code blocks.

## Archive Page

```yaml
taxonomy:
  archive_tag_limit: 16
```

`taxonomy.archive_tag_limit` caps the popular tags listed on the archive page, and the all-tags index lists every tag.

## Paths and Accessibility

```yaml
post_paths:
  default_root: posts
  language_roots:
    en: en/posts
skip_link: true
```

`post_paths.default_root` is the value of the `:post_root` permalink variable for the default language, and `post_paths.language_roots` sets it for each other language. `skip_link` is the keyboard skip link.

## Lists and Pagination

These options are read from the root `_config.yml`, outside `theme_config`:

```yaml
per_page: 10 # Posts per list page; 0 disables pagination, non-negative integers only
pagination_dir: page
archive_dir: archives
category_dir: categories
tag_dir: tags
index_generator:
  path: '' # Home directory; empty means the site root
archive_generator:
  per_page: 20 # Overrides per_page
  order_by: -date # A field name, or a map of fields to 1 and -1
  enabled: true
  yearly: true # false disables the year, month and day archives
  monthly: true
  daily: false
category_generator:
  per_page: 20
  order_by: -date
tag_generator:
  per_page: 20
  order_by: -date
  enable_index_page: true # false disables the all-tags index and its links
```

- The theme takes over the index, archive, category and tag list generators. Standard Hexo generators can stay installed, but another generator claiming the same route has to be removed.
- Home and the all-tags index are single pages, and `index_generator` only uses `path`.
- Empty home and archive indexes remain available, while taxonomy and date pages are generated only where the current language has posts.
- Every page emits a `<link rel="canonical">` to its own URL, and a language switch opens the other language's collection at page one, hidden when the two collections cannot be matched.

## Multilingual Site

Recommended options in the root `_config.yml`:

```yaml
language:
  - zh-CN
  - en
permalink: :post_root/:slug/
permalink_defaults:
  lang: zh-CN
  post_root: posts
new_post_name: :lang/:title.md
```

With `language: [zh-CN, en]` the default language is served from the site root and English from `/en/`. Posts of the default language are output as `/posts/:slug/` and English posts as `/en/posts/:slug/`, following `post_paths`. `language` takes a string or an array, and an unset value uses English. UI text shared by the languages lives in `languages/default.yml`, which does not have to be listed in `language`.

UI text comes from the theme's `languages/` directory, where the file name is the language code as written in the root `language` list. UI text lookup goes in this order: the `<lang>.yml` of the current page language, the other languages of the root `language` list, `languages/default.yml`, then the remaining language files. A key found in more than one place takes the first match, and the page shows the key name itself when no file defines it.

To add a language, put `<lang>.yml` in the theme's `languages/` directory with the same keys as `en.yml` and `zh-CN.yml`, then add the language code to the root `_config.yml` `language` list and add its post path prefix to `post_paths.language_roots`.

## Content and Pages

Front matter of a post:

```yaml
---
title: Building a multilingual site with Hexo
date: 2026-09-14 10:00:00
updated: 2026-09-15 09:30:00
categories:
  - Site
tags:
  - Hexo
  - Multilingual
description: Set up a Chinese and English site with localized routes and per-language feeds.
lang: en
toc: true
featured: false
---
```

- Translations share a slug and differ in `lang`. Use an English source filename or `hexo new --slug <slug>` to control the slug.
- `toc: false` removes the table of contents from a single post. `featured: true` adds the post to the featured list on the home page.
- Home, archive, category, tag and search results show the posts of the current page language. Previous and next navigation stays within the post language.
- Localized standalone pages live in language directories and set `lang` in their front matter:

```text
source/about/index.md
source/friends/index.md
source/en/about/index.md
source/en/friends/index.md
```

- Level-two headings in the about page are styled as sections. A friends page file defines the route and the page metadata, while the links come from `source/_data/friends.yml`.

## Search, Feeds and Callouts

The search overlay needs `hexo-generator-searchdb` installed. The theme side has only the switch and the index path, and that path has to match the generator output:

```yaml
theme_config:
  search:
    enable: true
    path: search.json
```

The options of the generator itself sit at the root `search` key of the site configuration, next to `theme_config`:

```yaml
search:
  path: search.json
  field: post
  content: true
  format: striptags
```

Set `search.enable` to `false` to turn the overlay off.

The theme writes language-aware Atom feeds from the `feed` options in the root `_config.yml` and needs no feed generator:

```yaml
feed:
  type: atom
  path: atom.xml
  limit: 20
  hub:
  content: true
  content_limit: 140
  content_limit_delim:
  order_by: -date
  enable: true
```

With `feed.path` set to `atom.xml` the default language feed is at `/atom.xml` and the English feed at `/en/atom.xml`. `feed.limit` caps the posts in each feed, `feed.content_limit` is the number of characters in the summary, `feed.content_limit_delim` cuts the summary at a delimiter, `feed.order_by` sets the entry order and `feed.hub` provides the publish-subscribe hub link. The theme writes no feed when `feed.type` does not include `atom`.

Obsidian-style callouts need `hexo-obsidian-callout` installed and enabled in the root `_config.yml`:

```yaml
obsidian_callout:
  enabled: true
```

The theme injects their styles and scripts and pins the `injectHead` option of the package to `false`.

## Image Viewer

Install `photoswipe` and enable the viewer in the root `_config.yml`:

```yaml
photoswipe:
  enabled: true
  selector: '.post-content :not(a) > img, .post-content > img'
  padding: 24
  bg_opacity: 0.96
  wheel_to_zoom: true
  initial_zoom_level: fit
  secondary_zoom_level: 1
  max_zoom_level: 4
  min_zoom_factor: 0.5
```

Padding can also be set per side, and extra selectors can be excluded:

```yaml
photoswipe:
  padding:
    top: 72
    bottom: 32
    left: 24
    right: 24
  exclude:
    - '.page-content-about img'
```

`padding` can be set per side, and `exclude` adds selectors to skip on top of the defaults.

`bg_opacity` ranges from 0 to 1 and `min_zoom_factor` from 0.1 to 1. `initial_zoom_level` takes `fit` to scale the image to the screen, while `secondary_zoom_level` and `max_zoom_level` are the level of the second click and the zoom limit.

Images wrapped in links are always skipped. The default exclusions are `.no-lightbox`, `.no-zoom`, `[data-no-lightbox]`, `[data-no-zoom]` and `[data-no-photoswipe]`. Theme chrome is not excluded, so its selectors have to be added by hand. A single image opts out with an exclusion attribute:

```html
<img src="https://example.com/image.png" alt="Screenshot" data-no-zoom>
```

## Friends Page

Create `source/_data/friends.yml` in the Hexo site:

```yaml
intro:
  en: Personal sites, project pages, and knowledge bases worth following.
  zh-CN: 值得长期阅读的个人站点、项目主页和知识库。
apply:
  description:
    en: Personal sites with steady, long-running writing are welcome to get in touch.
    zh-CN: 欢迎长期写作、内容稳定的个人网站联系交流。
groups:
  - name:
      en: Personal Blogs
      zh-CN: 个人博客
    description:
      en: Independent writing and long-running notes.
      zh-CN: 长期写作和技术记录。
    items:
      - name: Example
        url: https://example.com
        description:
          en: A concise description of the site.
          zh-CN: 站点简介。
        avatar: https://example.com/avatar.png
        tags:
          - Blog
          - Notes
```

Every entry under `groups[].items[]` is one friend and needs a `url`, while `name`, `description`, `avatar` and `tags` are filled in as needed. `intro`, `apply.description`, a group's `name` and `description`, and an entry's `description` accept a plain string or a value keyed by language. Site names usually keep their original spelling, and a group without entries is not rendered.

## Assets and Fonts

Favicon files and `site.webmanifest` belong in the site's `source/` directory. The theme links `/favicon.ico`, `/favicon-32x32.png`, `/favicon-16x16.png`, `/apple-touch-icon.png` and `/site.webmanifest`.

Fonts and their license files live in the theme's `source/fonts/`.
