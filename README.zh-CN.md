<div align="center">
  <h1>ZhiMo</h1>
  <p>面向长文技术写作的纸面与墨色 Hexo 主题。</p>
  <p>
    <a href="https://www.npmjs.com/package/hexo-theme-zhimo"><img alt="npm 版本" src="https://img.shields.io/npm/v/hexo-theme-zhimo?style=flat-square&color=c43a10&logo=npm&logoColor=white"></a>
    <a href="LICENSE"><img alt="MIT 许可" src="https://img.shields.io/badge/license-MIT-c43a10?style=flat-square"></a>
    <img alt="Hexo 7 或更高版本" src="https://img.shields.io/badge/hexo-%E2%89%A57-0e83cd?style=flat-square&logo=hexo&logoColor=white">
    <img alt="Node.js 18 或更高版本" src="https://img.shields.io/badge/node-%E2%89%A518-5fa04e?style=flat-square&logo=nodedotjs&logoColor=white">
  </p>
  <p><a href="README.md">English</a> | 简体中文</p>
  <img src="https://raw.githubusercontent.com/ADabbler/hexo-theme-zhimo/main/docs/images/home-paper.webp" alt="纸页模式的首页">
</div>

---

## 功能

- **阅读优先的版式**：首页、文章页、归档、分类、标签、全部标签页、友链与普通页面
- **三种配色模式**：跟随系统、纸页、墨夜
- **封面式首页**：整屏封面、最新与精选文章列表
- **多语言界面**：内置英文与简体中文，本地化路由、按 slug 匹配译文、按语言拆分 Atom feed
- **阅读辅助**：本地搜索浮层、文章目录、阅读时间、相关文章、上一篇/下一篇
- **代码块**：行号、语言标签与复制按钮
- **页面 meta**：Open Graph、Twitter Card、canonical 与 `hreflang`
- **自托管字体**：四套字体随主题分发

## 界面预览

截图取自[在线演示站点](https://www.dabbler.top)。

<p align="center">
  <img width="49%" src="https://raw.githubusercontent.com/ADabbler/hexo-theme-zhimo/main/docs/images/home-ink.webp" alt="墨夜模式的首页">
  <img width="49%" src="https://raw.githubusercontent.com/ADabbler/hexo-theme-zhimo/main/docs/images/archive.webp" alt="含主题索引与文章列表的归档页">
</p>
<p align="center">
  <img width="49%" src="https://raw.githubusercontent.com/ADabbler/hexo-theme-zhimo/main/docs/images/post.webp" alt="带目录的文章页">
  <img width="49%" src="https://raw.githubusercontent.com/ADabbler/hexo-theme-zhimo/main/docs/images/code-block.webp" alt="带行号、语言标签与复制按钮的代码块">
</p>
<p align="center">
  <img width="42%" src="https://raw.githubusercontent.com/ADabbler/hexo-theme-zhimo/main/docs/images/mobile-home.webp" alt="手机上的首页">
</p>

## 环境要求

- Hexo 7 下需要 Node.js 18 或更高版本
- Hexo 8 下需要 Node.js 20.19 或更高版本
- `hexo-renderer-ejs`

## 安装

在站点中安装主题：

```sh
npm install hexo-theme-zhimo
```

在根 `_config.yml` 中启用：

```yaml
theme: zhimo
```

## 配置

主题配置写进根 `_config.yml` 的 `theme_config`，或根目录的 `_config.zhimo.yml`。两者都写时以 `theme_config` 为准。

全部配置项、可选集成与主题默认值见[配置指南](https://github.com/ADabbler/hexo-theme-zhimo/blob/main/docs/configuration.zh-CN.md)与主题的 `_config.yml`。

## 可选集成

- **本地搜索浮层**：安装 `hexo-generator-searchdb`，设置 `theme_config.search.enable: false` 可关闭。
- **Obsidian callout**：安装 `hexo-obsidian-callout`，设置 `obsidian_callout.enabled: true` 启用。
- **文章图片查看器**：安装 `photoswipe`，设置 `photoswipe.enabled: true` 启用。
- **友链页面**：在站点中添加 `source/_data/friends.yml`，字段说明见[配置指南](https://github.com/ADabbler/hexo-theme-zhimo/blob/main/docs/configuration.zh-CN.md#友链页面)。

## 贡献

问题与建议请提交到 [Issues](https://github.com/ADabbler/hexo-theme-zhimo/issues)。改动代码前请先读[贡献指南](https://github.com/ADabbler/hexo-theme-zhimo/blob/main/docs/CONTRIBUTING.zh-CN.md)，其中说明了源码结构、构建流程、验证与打包等。

## 许可

主题代码采用 [MIT 许可](https://github.com/ADabbler/hexo-theme-zhimo/blob/main/LICENSE)。内置的四套自托管字体 Source Serif 4、Geist Sans、JetBrains Mono NL 与 Noto Serif SC 均为 OFL-1.1，许可文件随字体放在 `source/fonts/`。
