# Contributing to Agentry

## Setup

- Node 22.6 or newer, and pnpm 11 (`corepack enable` picks the version from `package.json`).
- For the desktop shell only: Rust stable plus the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.
- To run workflows: opencode 1.17.20 or newer (the versions we verified are listed in the README).

```sh
pnpm install
pnpm dev            # the editor in a browser, http://localhost:5173
pnpm tauri dev      # the same editor in the desktop window
pnpm verify         # everything CI runs; do this before opening a pull request
```

## Where things live

| Path | What |
|---|---|
| `packages/core` | The `workflow.yaml` types, validation and run semantics. Shared by every other package. |
| `packages/canvas` | The node canvas (editor and live panel). |
| `packages/design` | Design tokens and the 15 color themes. |
| `packages/app` | The editor (Vite + React, wrapped by Tauri in `src-tauri`). |
| `packages/plugin` | The opencode plugin: runs a workflow and serves the live panel. |
| `packages/trigger` | `agentry-watch`, which starts workflows from their `on:` triggers. |
| `packages/mcp` | `agentry-mcp`, the MCP server that lets other agents edit and run workflows. |
| `workflows/` | Example workflows. |
| `design/logo/` | Logo files; `app-icon-1024.png` is the source of the desktop icons. |

Three rules keep the editor and the runtime in step:

1. **Contract changes go through core.** A new `workflow.yaml` field, run event or panel endpoint changes `packages/core` first (its types are the reference), then the format notes in both READMEs if users see it, and the pull request says so.
2. **The plugin is built, never edited.** Change `packages/plugin/src`, run `pnpm --filter @agentry/plugin build`, and commit the regenerated `.opencode/plugins/agentry.js`. CI fails when the bundle is stale.
3. **Tokens feed the panel.** After editing `packages/design/src/tokens.css`, rebuild the plugin as well; the panel's colors are generated from that file.

## Branches, commits, pull requests

`main` only changes through pull requests.

1. Branch off `main`: `feat/…`, `fix/…`, `docs/…`, `refactor/…` or `chore/…`.
2. Write commits in the [Conventional Commits](https://www.conventionalcommits.org/) style this repo already uses, for example `feat(canvas): …` or `fix(plugin): …`.
3. Run `pnpm verify`, push the branch and open a pull request. Use a draft while it is unfinished.
4. CI must be green before the pull request can merge. A review is welcome but not required.
5. Merge with **Squash and merge**. The pull request title becomes the commit on `main`, so keep it in the same style. Delete the branch afterwards.

User-visible changes add a line under `[Unreleased]` in `CHANGELOG.md`.

## Versions and releases

Agentry follows [Semantic Versioning](https://semver.org/). Every package, the Tauri config and the desktop crate share one number, kept in sync by `scripts/version.mjs`. While the version is 0.x, a minor bump (0.1 to 0.2) may contain breaking changes and a patch bump (0.1.0 to 0.1.1) only fixes things.

To release:

1. On a branch: `node scripts/version.mjs bump minor` (or `patch`, or `set X.Y.Z`), and rename the `[Unreleased]` heading in `CHANGELOG.md` to `[X.Y.Z] - YYYY-MM-DD` with a fresh empty `[Unreleased]` above it.
2. Merge that pull request.
3. Tag `main`: `git tag vX.Y.Z` and `git push origin vX.Y.Z`.
4. The Release workflow builds a draft GitHub release with the plugin, `agentry-watch`, `agentry-mcp` and the desktop installers. Check it, then publish it.
5. Publishing the release starts the npm workflow, which publishes `agentry-mcp`, `agentry-watch` and `opencode-agentry` from the release files. It needs the `NPM_TOKEN` repository secret (an npm automation token); without it the workflow only does a dry run. For a release that is already out, run the npm workflow by hand with its tag.
