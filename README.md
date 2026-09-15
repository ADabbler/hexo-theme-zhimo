<div align="center">
  <h1>ZhiMo</h1>
  <p>A paper-and-ink, multilingual Hexo theme for long-form technical writing.</p>
  <p>
    <a href="https://www.npmjs.com/package/hexo-theme-zhimo"><img alt="npm version" src="https://img.shields.io/npm/v/hexo-theme-zhimo?style=flat-square&color=c43a10&logo=npm&logoColor=white"></a>
    <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-c43a10?style=flat-square"></a>
    <img alt="Hexo 7 or later" src="https://img.shields.io/badge/hexo-%E2%89%A57-0e83cd?style=flat-square&logo=hexo&logoColor=white">
    <img alt="Node.js 18 or later" src="https://img.shields.io/badge/node-%E2%89%A518-5fa04e?style=flat-square&logo=nodedotjs&logoColor=white">
  </p>
  <p>English | <a href="README.zh-CN.md">简体中文</a></p>
  <img src="https://raw.githubusercontent.com/ADabbler/hexo-theme-zhimo/main/docs/images/home-paper.webp" alt="Home page in Paper mode">
</div>

---

## Features

- **Reading-first layouts** for home, article, archive, category, tag, tag index, friends and standalone pages
- **Three color modes**: follow system, Paper (light) and Ink Night (dark)
- **Cover home page**: full-height cover, latest and featured post lists
- **Multilingual UI**: English and Simplified Chinese built in, localized routes, translations matched by slug, per-language Atom feeds
- **Reading aids**: local search overlay, article table of contents, reading time, related posts, previous/next navigation
- **Code blocks** with line numbers, language label and copy button
- **Page meta**: Open Graph, Twitter Card, canonical URLs and `hreflang` alternates
- **Self-hosted webfonts**: four families bundled with the theme

## Screenshots

The screenshots come from the [live demo](https://www.dabbler.top).

<p align="center">
  <img width="49%" src="https://raw.githubusercontent.com/ADabbler/hexo-theme-zhimo/main/docs/images/home-ink.webp" alt="Home page in Ink Night mode">
  <img width="49%" src="https://raw.githubusercontent.com/ADabbler/hexo-theme-zhimo/main/docs/images/archive.webp" alt="Archive page with a taxonomy index and a post list">
</p>
<p align="center">
  <img width="49%" src="https://raw.githubusercontent.com/ADabbler/hexo-theme-zhimo/main/docs/images/post.webp" alt="Article page with a table of contents">
  <img width="49%" src="https://raw.githubusercontent.com/ADabbler/hexo-theme-zhimo/main/docs/images/code-block.webp" alt="Code block with line numbers, language label and copy button">
</p>
<p align="center">
  <img width="42%" src="https://raw.githubusercontent.com/ADabbler/hexo-theme-zhimo/main/docs/images/mobile-home.webp" alt="Home page on a phone">
</p>

## Requirements

- Hexo 7 with Node.js 18 or later
- Hexo 8 with Node.js 20.19 or later
- `hexo-renderer-ejs`

## Installation

Install the theme in your site:

```sh
npm install hexo-theme-zhimo
```

Activate it in the root `_config.yml`:

```yaml
theme: zhimo
```

## Configuration

Theme settings go under `theme_config` in the root `_config.yml`, or in a `_config.zhimo.yml` file next to it. When both are set, `theme_config` wins.

All options, optional integrations and the theme defaults are in the [configuration guide](https://github.com/ADabbler/hexo-theme-zhimo/blob/main/docs/configuration.md) and the theme's `_config.yml`.

## Optional Integrations

- **Local search overlay** — install `hexo-generator-searchdb`; switch the overlay off with `theme_config.search.enable: false`.
- **Obsidian callouts** — install `hexo-obsidian-callout` and set `obsidian_callout.enabled: true`.
- **Post image viewer** — install `photoswipe` and set `photoswipe.enabled: true`.
- **Friends page** — add `source/_data/friends.yml` to the site, documented in the [configuration guide](https://github.com/ADabbler/hexo-theme-zhimo/blob/main/docs/configuration.md#friends-page).

## Contributing

Bugs and feature requests go to the [issue tracker](https://github.com/ADabbler/hexo-theme-zhimo/issues). Read the [contributing guide](https://github.com/ADabbler/hexo-theme-zhimo/blob/main/docs/CONTRIBUTING.md) before changing code. It covers the source layout, the build pipeline, validation and packaging.

## License

Theme code is released under the [MIT license](https://github.com/ADabbler/hexo-theme-zhimo/blob/main/LICENSE). The four bundled fonts, Source Serif 4, Geist Sans, JetBrains Mono NL and Noto Serif SC, are all under OFL-1.1, with license files shipped beside them in `source/fonts/`.
