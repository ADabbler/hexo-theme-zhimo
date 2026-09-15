# 纸墨主题配置指南

[English](configuration.md) · [README](../README.zh-CN.md) · [贡献指南](CONTRIBUTING.zh-CN.md)

## 配置位置与优先级

主题默认值写在主题自己的 `_config.yml` 里。站点可以从两处覆盖，`theme_config` 优先于 `_config.zhimo.yml`：

```yaml
# 站点根 _config.yml
theme_config:
  site:
    subtitle: 记录系统与软件
  latest_count: 8
```

```yaml
# 站点根 _config.zhimo.yml
site:
  subtitle: 记录系统与软件
latest_count: 8
```

下面各节的主题配置项片段是默认值，站点配置里只需写要改的部分。

## 导航与联系方式

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

`menu` 的键取自 `languages/*.yml` 里的界面文案键，值为路径，可以增删条目或调整顺序，新增条目之前先在语言文件里补上它的键。

`social` 的条目展示在页脚、关于页与友链页。`RSS` 的链接取自当前页面语言对应的 feed 路径，其余键可写完整 URL 或 `mailto:` 地址，其中 `Email` 会同时成为友链页的申请入口。

## 站点文案与首页

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

`site.subtitle`、`site.description` 与 `home.cover_kicker` 依次是站点副标题、站点描述和首页封面标题上方的小标题，都能写普通字符串或按语言取值的对象。

`latest_count` 与 `featured_count` 是首页最新列表与精选列表的条数，`excerpt_length` 是列表摘要的字数。

没有任何文章设置 `featured: true` 时首页跳过精选区块。已出现在最新列表中的文章不会在精选区块重复。

## 页脚

```yaml
footer:
  show_powered: true
  records: []
```

`footer.show_powered` 控制页脚的主题署名，`footer.records` 用于备案等合规条目，空数组不渲染任何内容。

条目示例：

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

每个条目包含 `text`，以及可选的 `url`、`icon`、`icon_alt` 和 `aria_label`。`text`、`icon_alt`、`aria_label` 可写普通字符串或按语言取值的对象。

## 文章页

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

`toc.enable` 是文章目录的开关，`toc.min_depth` 与 `toc.max_depth` 是收录的标题层级，`toc.max_items` 是条目上限，`toc.list_number` 决定是否给条目编号。

`related_posts.enable` 是相关文章的开关，按共同分类与标签选出同语言文章，条数由 `related_posts.count` 决定。`highlight.copy_button` 是代码块上的复制按钮。

## 归档页

```yaml
taxonomy:
  archive_tag_limit: 16
```

`taxonomy.archive_tag_limit` 限定归档页展示的常用标签数量，全部标签页展示所有标签。

## 路径与无障碍

```yaml
post_paths:
  default_root: posts
  language_roots:
    en: en/posts
skip_link: true
```

`post_paths.default_root` 是默认语言的 `:post_root` 永久链接变量取值，`post_paths.language_roots` 为其他语言分别指定该取值。`skip_link` 是键盘跳转链接。

## 列表与分页

以下配置项从根 `_config.yml` 读取，不放进 `theme_config`：

```yaml
per_page: 10 # 每个列表页的文章数，取 0 表示不分页，只接受非负整数
pagination_dir: page
archive_dir: archives
category_dir: categories
tag_dir: tags
index_generator:
  path: '' # 首页目录，空值表示站点根
archive_generator:
  per_page: 20 # 优先于 per_page
  order_by: -date # 字段名，或把多个字段映射为 1 与 -1
  enabled: true
  yearly: true # 取 false 关闭年、月、日归档
  monthly: true
  daily: false
category_generator:
  per_page: 20
  order_by: -date
tag_generator:
  per_page: 20
  order_by: -date
  enable_index_page: true # 取 false 关闭全部标签页并省略其入口
```

- 主题接管 index、archive、category、tag 四个列表生成器，标准 Hexo 生成器可以保留安装，其他生成器争用同一路由时必须移除。
- 首页与全部标签页为单页，`index_generator` 只使用 `path`。
- 没有文章时首页与归档首页保留空状态，分类、标签与日期页仅在该语言存在文章时生成。
- 分页页在 `<head>` 里输出 `<link rel="canonical">` 指向该页自身，语言切换链接进入目标语言同一集合的第一页，两个集合无法对应时不显示切换。

## 多语言站点

根 `_config.yml` 的推荐配置：

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

`language: [zh-CN, en]` 时，默认语言在站点根，英文在 `/en/`。默认语言文章输出为 `/posts/:slug/`，英文文章输出为 `/en/posts/:slug/`，由 `post_paths` 决定。`language` 支持字符串或数组，未配置时使用英文。各语言共用的文案放在 `languages/default.yml`，不需要写进语言列表。

界面文案取自主题的 `languages/` 目录，文件名即语言代码，与根 `language` 中的写法一致。界面文案按下面的顺序查找：当前页面语言的 `<lang>.yml`、根 `language` 列表中的其他语言、`languages/default.yml`、目录里剩下的语言文件。同一个键在多处出现时取先找到的一处，任何文件都没有定义时页面显示键名本身。

新增一门语言时，把 `<lang>.yml` 放进主题的 `languages/` 目录，键名与 `en.yml`、`zh-CN.yml` 相同，再把语言代码加进根 `_config.yml` 的 `language` 列表，并在 `post_paths.language_roots` 里补上它的文章路径前缀。

## 内容与页面

文章 Front Matter：

```yaml
---
title: 用 Hexo 搭建多语言站点
date: 2026-09-14 10:00:00
updated: 2026-09-15 09:30:00
categories:
  - 建站
tags:
  - Hexo
  - 多语言
description: 从零配置中英文双语站点、本地化路由与按语言拆分的 feed。
lang: zh-CN
toc: true
featured: false
---
```

- 译文共用同一 slug，`lang` 不同。用英文文件名或 `hexo new --slug <slug>` 指定 slug。
- `toc: false` 关闭单篇文章的目录。`featured: true` 将文章加入首页精选列表。
- 首页、归档、分类、标签和搜索结果显示当前页面语言的文章。上一篇/下一篇导航保持在文章语言内。
- 本地化普通页面放在语言目录下，并在 Front Matter 中设置 `lang`：

```text
source/about/index.md
source/friends/index.md
source/en/about/index.md
source/en/friends/index.md
```

- 关于页的二级标题会渲染为区块。友链页文件决定路由与页面元信息，链接数据来自 `source/_data/friends.yml`。

## 搜索、订阅与提示框

搜索浮层需要安装 `hexo-generator-searchdb`。主题侧只有开关与索引路径，索引路径要与生成器的输出一致：

```yaml
theme_config:
  search:
    enable: true
    path: search.json
```

生成器自身的配置项在站点配置根级的 `search` 键下，与 `theme_config` 平级：

```yaml
search:
  path: search.json
  field: post
  content: true
  format: striptags
```

把 `search.enable` 设为 `false` 可关闭浮层。

主题根据根 `_config.yml` 的 `feed` 生成按语言拆分的 Atom feed，不需要额外的 feed 生成器：

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

`feed.path` 为 `atom.xml` 时，默认语言 feed 位于 `/atom.xml`，英文 feed 位于 `/en/atom.xml`。`feed.limit` 是每个 feed 的文章数上限，`feed.content_limit` 是摘要的字符数，`feed.content_limit_delim` 指定摘要截断用的分隔符，`feed.order_by` 决定条目顺序，`feed.hub` 用于填写发布订阅 hub 地址。`feed.type` 不含 `atom` 时主题不生成 feed。

Obsidian 风格提示框需要安装 `hexo-obsidian-callout`，并在根 `_config.yml` 启用：

```yaml
obsidian_callout:
  enabled: true
```

样式与脚本由主题注入，插件自身的 `injectHead` 会被主题固定为 `false`。

## 图片查看器

安装 `photoswipe`，并在根 `_config.yml` 启用：

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

可以按边设置留白，并追加要排除的选择器：

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

`padding` 可以按边写，`exclude` 追加要跳过的选择器，并与默认排除项合并。

`bg_opacity` 取 0 到 1，`min_zoom_factor` 取 0.1 到 1。`initial_zoom_level` 的 `fit` 表示按屏幕适配，`secondary_zoom_level` 与 `max_zoom_level` 分别是再次点击与最大缩放级别。

被链接包裹的图片始终跳过，默认排除项为 `.no-lightbox`、`.no-zoom`、`[data-no-lightbox]`、`[data-no-zoom]` 与 `[data-no-photoswipe]`。主题界面元素不在默认排除范围内，需要自己追加选择器。单张图片可用排除属性退出：

```html
<img src="https://example.com/image.png" alt="Screenshot" data-no-zoom>
```

## 友链页面

在 Hexo 站点中创建 `source/_data/friends.yml`：

```yaml
intro:
  zh-CN: 值得长期阅读的个人站点、项目主页和知识库。
  en: Personal sites, project pages, and knowledge bases worth following.
apply:
  description:
    zh-CN: 欢迎长期写作、内容稳定的个人网站联系交流。
    en: Personal sites with steady, long-running writing are welcome to get in touch.
groups:
  - name:
      zh-CN: 个人博客
      en: Personal Blogs
    description:
      zh-CN: 长期写作和技术记录。
      en: Independent writing and long-running notes.
    items:
      - name: Example
        url: https://example.com
        description:
          zh-CN: 站点简介。
          en: A concise description of the site.
        avatar: https://example.com/avatar.png
        tags:
          - Blog
          - Notes
```

`groups[].items[]` 的每个条目是一个友链，必须有 `url`，`name`、`description`、`avatar` 与 `tags` 按需填写。`intro`、`apply.description`、分组的 `name` 与 `description`，以及条目的 `description`，都可以写普通字符串或按语言取值的对象。站点名通常保留原文拼写，没有条目的分组不会渲染。

## 静态资源与字体

favicon 与 `site.webmanifest` 放在站点的 `source/` 目录，主题引用 `/favicon.ico`、`/favicon-32x32.png`、`/favicon-16x16.png`、`/apple-touch-icon.png` 与 `/site.webmanifest`。

字体与许可文件放在主题的 `source/fonts/`。
