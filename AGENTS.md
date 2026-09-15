# AGENTS.md

Operating constraints for this repository. Sources of truth:

- `README.md` — installation, quick configuration, screenshots, bundled font licenses
- `docs/configuration.md` — theme options, integrations, content conventions
- `docs/CONTRIBUTING.md` — source layout, build pipeline, editing rules, validation, packaging, commit messages
- `_config.yml` — theme defaults, the values a site overrides

## Overview

- Package `hexo-theme-zhimo` (Chinese name 纸墨), MIT licensed, a reusable Hexo theme intended for public release.
- Standalone repository; sites consume it as an npm package or through a link, and the repository never contains site content.
- Browser-side sources are the CSS (`@layer`) and TypeScript (ESM) under `_app/`, built by the esbuild pipeline in `tools/build.mjs` into `source/css` and `source/js`. Build outputs are not tracked; `prepare` builds them for the published package, and npm also runs it on a local install. Published packages contain the compiled assets.
- The Node-side Hexo scripts in `scripts/` are CommonJS runtime dependencies and stay JavaScript.

## Boundaries

- Keep the theme generic and reusable: no site names, domains, filing numbers, social accounts, or single-post logic. Site values live in the site configuration.
- Optional plugin integrations use dedicated CSS, scripts, and Hexo registration hooks loaded by configuration, never the main pipeline files. They are switched on from the root site configuration next to `theme_config`, as `photoswipe` and `obsidian_callout` are, and their options are read from there. A script that needs an optional site package resolves it from `hexo.base_dir`.
- Do not hand-edit the generated files under `source/css/`, `source/js/` or `source/fonts/serif-sc/`; change the `_app/` sources and rebuild, or run `pnpm run sync-serif-sc` for the Chinese serif subsets.
- Font files keep their license files beside them.
- Change both language versions of a document together, and keep `docs/images/` in step with the theme's appearance.
- Commit messages follow `<type>(<scope>): <description>`, with a lowercase English description in the imperative mood.

## Verification

Commands and validation steps are in `docs/CONTRIBUTING.md`. Run `pnpm run check` and `pnpm run check:package` before finishing; for end-to-end verification run `hexo generate` in a Hexo site that loads this theme and inspect the rendered pages and the fingerprinted assets.
