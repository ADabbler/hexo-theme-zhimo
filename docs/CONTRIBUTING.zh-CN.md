# 纸墨主题贡献指南

[English](CONTRIBUTING.md) · [README](../README.zh-CN.md) · [配置指南](configuration.zh-CN.md)

## 开发环境

构建主题需要 Node.js 22.13 或更高版本。主题在站点中运行时，Hexo 7 下需要 Node.js 18 或更高版本，Hexo 8 下需要 20.19 或更高版本。在主题仓库根目录安装依赖：

```sh
pnpm install
```

| 命令 | 用途 |
| --- | --- |
| `pnpm run build` | 将浏览器 CSS/TypeScript 编译、压缩到 `source/`。 |
| `pnpm run watch` | 监听源码变化并重建，不压缩并内联 source map。 |
| `pnpm run typecheck` | 检查浏览器 TypeScript，不生成文件。 |
| `pnpm run check` | 依次执行类型检查和构建。 |
| `pnpm run check:package` | 校验发布包内容。 |
| `pnpm run sync-serif-sc` | 重新生成中文衬线字体切片。 |

预览主题改动需要接入一个 Hexo 站点。用 `link:` 依赖、`npm link` 或 `themes/zhimo` 目录链接把本仓库接入站点，再在站点配置里设 `theme: zhimo`。

`source/js/` 与打包 CSS 不入库，工作副本里没有编译后的浏览器资源，所以预览前先在主题仓库运行 `pnpm run build`，或者直接运行 `pnpm run watch` 让它随改动重建。然后在站点运行 `hexo server`。

`scripts/`、`lib/` 与站点根 `_config.yml`、`_config.zhimo.yml` 在启动时读取，改动后要重启 Hexo server。主题的 `_config.yml`、`layout/`、`languages/` 与重建后的浏览器资源会被监听，刷新页面即可。

## 源码位置

| 路径 | 职责 |
| --- | --- |
| `_app/styles/` | CSS 模块、设计变量、响应式规则与打印样式。 |
| `_app/scripts/` | 浏览器 TypeScript，公共代码在 `lib/`，页面行为在 `features/`。 |
| `layout/`、`languages/` | EJS 模板与界面翻译。 |
| `lib/language.js` | 语言解析与多语言路径。 |
| `lib/listings.js` | 按语言筛选的列表、分页与路由表。 |
| `scripts/register-lists.js` | 注册生成器并检测路由冲突。 |
| `scripts/helpers.js` | 模板 helper、Atom feed 与资源指纹。 |
| `scripts/register-*.js` | 可选集成的注册钩子。 |
| `tools/build.mjs` | 编译浏览器资源并清理陈旧产物。 |
| `tools/sync-serif-sc.mjs` | 重新生成中文衬线字体切片。 |
| `tools/verify-package.mjs` | 校验发布包内容。 |

服务端模块使用 CommonJS JavaScript，浏览器 TypeScript 构建为 ESM。浏览器构建只输出顶层入口文件，因此生成的 CSS 与 JavaScript 全部包含在 `scripts/helpers.js` 的指纹列表中。可选集成从 `hexo.base_dir` 解析站点依赖，以支持位于站点目录之外的主题链接。

`register-lists.js` 在 `after_init` 中替换标准列表生成器。每轮生成根据可见文章及其分类、标签关系重建路由表，模板据此输出分页与语言链接。其他生成器争用相同路径时明确报错。`after_generate` 过滤器不受影响。

## 修改规则

- 修改 `_app/` 源码后重新构建，生成的 `source/js/` 和打包 CSS 不入库。
- 新 CSS 层与 import 在 `_app/styles/main.css` 中登记。响应式文件按 `max-width` 从大到小导入，使窄断点覆盖宽断点。
- 全站断点集中在 `responsive/`，组件自己的媒体查询可留在组件文件中。
- 可选集成的样式和脚本独立于主入口。
- 界面文案写入两份语言文件，中英文文档同步更新。
- 界面外观变化后，同步更新 README 中的截图。
- 发布内容由 `package.json` 的 `files` 白名单决定，新增运行时代码目录时要同步加入。
- 颜色、字号、间距与圆角取自 `_app/styles/tokens.css`，不在组件里写死。

静态字体 CSS 与字体文件需要入库。更新中文衬线切片时运行 `pnpm run sync-serif-sc`，脚本会下载固定版本的 WASM 切分器并校验 SHA-256。生成的 CSS、字体及相邻许可证文件应一起审查。

## 验证与打包

```sh
pnpm run check
pnpm run check:package
```

第二条命令校验已经构建好的发布内容，确认 `layout/`、`lib/`、`scripts/`、编译后的 CSS/JS、字体与许可证都在包里，`_app/`、`docs/`、`tools/` 没有进包。

## 提交信息

提交信息写 `<type>(<scope>): <description>`，描述用英文小写祈使句，句末不加句点。

- `type` 取 `feat`、`fix`、`docs`、`refactor`、`perf`、`build`、`ci`、`chore` 等
- `scope` 是改动的区域，例如 `pagination`、`i18n`、`listings`、`styles`、`docs`、`ci`、`package` 等
- 发版提交的正文会成为发行说明，正文为空时发布流程会失败
