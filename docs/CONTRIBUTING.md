# Contributing to ZhiMo

[简体中文](CONTRIBUTING.zh-CN.md) · [README](../README.md) · [Configuration guide](configuration.md)

## Development

Building the theme needs Node.js 22.13 or later. Running it in a site needs Node.js 18 or later on Hexo 7, and Hexo 8 requires 20.19 or later. Install dependencies from the theme repository:

```sh
pnpm install
```

| Command | Purpose |
| --- | --- |
| `pnpm run build` | Compile and minify browser CSS/TypeScript into `source/`. |
| `pnpm run watch` | Rebuild on source changes, unminified with inline source maps. |
| `pnpm run typecheck` | Check browser TypeScript without emitting files. |
| `pnpm run check` | Run type checking and build. |
| `pnpm run check:package` | Verify the contents of the published package. |
| `pnpm run sync-serif-sc` | Regenerate Chinese serif font subsets. |

Preview theme changes in a Hexo site. Link this repository into the site with a `link:` dependency, `npm link` or a directory link at `themes/zhimo`, then set `theme: zhimo` in the site configuration.

A working copy has no compiled browser assets, since `source/js/` and the bundled CSS are not tracked, so run `pnpm run build` here before previewing, or run `pnpm run watch` to rebuild on every change. Then run `hexo server` in the site.

`scripts/`, `lib/`, and the site's root `_config.yml` and `_config.zhimo.yml` are read at startup, so restart the Hexo server after editing them. The theme's `_config.yml`, `layout/`, `languages/` and the rebuilt browser assets are watched, so a page refresh is enough.

## Source layout

| Path | Responsibility |
| --- | --- |
| `_app/styles/` | CSS modules, tokens, responsive rules and print styles. |
| `_app/scripts/` | Browser TypeScript, shared code in `lib/`, page behavior in `features/`. |
| `layout/`, `languages/` | EJS templates and translated UI strings. |
| `lib/language.js` | Language resolution and localized paths. |
| `lib/listings.js` | Language-filtered lists, pagination and their route table. |
| `scripts/register-lists.js` | Generator registration and conflicting-route detection. |
| `scripts/helpers.js` | Template helpers, Atom feeds and asset fingerprints. |
| `scripts/register-*.js` | Optional integration hooks. |
| `tools/build.mjs` | Browser asset compilation and stale-output cleanup. |
| `tools/sync-serif-sc.mjs` | Regenerate Chinese serif font subsets. |
| `tools/verify-package.mjs` | Verify the contents of the published package. |

Server-side modules use CommonJS JavaScript. Browser TypeScript is built as ESM. Browser builds emit only top-level entry files, so every generated CSS and JavaScript file is covered by the fingerprint list in `scripts/helpers.js`. Optional integrations resolve packages from `hexo.base_dir`, so they also work when the theme is linked from outside the site.

`register-lists.js` replaces the standard list generators during `after_init`. Each generation rebuilds the route table from visible posts and their taxonomy relations. Template helpers use that table for pagination and language links. Competing generators fail explicitly. `after_generate` filters are unaffected.

## Editing rules

- Edit `_app/` sources, then rebuild. Generated `source/js/` and bundled CSS are not tracked.
- Declare new CSS layers and imports in `_app/styles/main.css`. Import responsive files from the largest `max-width` to the smallest, so narrower rules win.
- Keep site-wide breakpoints under `responsive/`, while local component queries can stay with their component.
- Keep optional integration styles and scripts separate from the main entries.
- Put UI text in both language files, and update the English and Chinese documentation together.
- Update the README screenshots when the interface appearance changes.
- The published package contains what the `files` whitelist in `package.json` lists, so add new runtime code directories to it.
- Take colors, font sizes, spacing and radii from `_app/styles/tokens.css` instead of hard-coding them in components.

Static font CSS and font files are tracked. To update the Chinese serif subsets, run `pnpm run sync-serif-sc`, which downloads the pinned WASM splitter and verifies its SHA-256. Review the generated CSS, fonts and adjacent license files together.

## Validation and packaging

```sh
pnpm run check
pnpm run check:package
```

The second command verifies the already built package. It confirms that `layout/`, `lib/`, `scripts/`, compiled CSS/JS, fonts and licenses are included, and that `_app/`, `docs/` and `tools/` stay out.

## Commit messages

Write commit messages as `<type>(<scope>): <description>`, with a lowercase English description in the imperative mood and no trailing period.

- `type` is usually one of `feat`, `fix`, `docs`, `refactor`, `perf`, `build`, `ci`, `chore`
- `scope` names the changed area, for example `pagination`, `i18n`, `listings`, `styles`, `docs`, `ci`, `package`
- The body of the release commit becomes the release notes, and an empty body fails the release
