---
name: hermes-docs
description: "Read and write Hermes Agent documentation: the Docusaurus site under website/docs (plugin contract, provider guides, sidebars.ts) and internal design notes under docs/."
provides: [doc.read, doc.write]
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(git add:*), Bash(git commit:*)
---

# Hermes Docs

Read docs from the release tree `/workspace/extra/hermes-release/website/docs/` when citing; edit them in the fork worktree `/workspace/agent/wt-<target_slug>/website/docs/`. `website/docs/**` is one of the three paths a plugin PR may touch without a CORE-CHANGE ADR section.

## Where docs live

| Path | What |
|---|---|
| `website/docs/` | Docusaurus 3.10 site (hermes-agent.nousresearch.com/docs): `getting-started/`, `user-guide/`, `developer-guide/`, `guides/`, `integrations/`, `reference/`, `index.mdx` |
| `website/docs/developer-guide/plugins/index.md` | THE plugin contract ("Build a Hermes Plugin"): interface map 12-20, compat contract 107-163, doctor 181-198, manifest 204-256, v2 276-310, handlers 467-472, storage 665-685, override 855-910, hook table 923-951, middleware 1064-1100 |
| `website/docs/developer-guide/*-plugin.md` | one page per provider ABC: model-provider, memory-provider, context-engine, secret-source, image-gen, video-gen, web-search, browser-provider, terminal-environment; plus `plugin-llm-access.md`, `desktop-plugin-sdk.md`, `subagent-lifecycle-api.md` |
| `website/docs/user-guide/features/plugins.md`, `built-in-plugins.md`, `hooks.md` | user-facing plugin usage; hooks.md carries the full per-hook signature reference |
| `website/docs/user-guide/profile-distributions.md` | `distribution.yaml`, `hermes profile install/update` |
| `website/sidebars.ts` | HAND-MAINTAINED sidebar of doc ids — a new page is invisible until added (Plugins category at 777-795; user-guide plugins at 89-90) |
| `docs/` | internal notes: `docs/ADR.md` (dated entries: `## YYYY-MM-DD: <title>`, `Status:`, `Context:`, `Decision:`), `middleware/`, `security/`, `rfcs/`, `design/`, `kanban/`, `observability/` |
| `AGENTS.md`, `CONTRIBUTING.md` | contributor rules (not published); `website/docs/developer-guide/contributing.md` is the published summary |

## Page conventions (match the neighbours)

- Frontmatter: `sidebar_label`, `slug` (`/developer-guide/<page>`), `title`, `description` (plugins/index.md:1-6); some pages use `sidebar_position` instead (contributing.md:1-5). One `# H1` right after the frontmatter.
- Plugin/ABC pages open with what it is and how the user selects it in `config.yaml`, then the `register(ctx)` flow, and cross-link sibling guides with absolute site paths (`/developer-guide/browser-provider-plugin`) as terminal-environment-plugin.md:1-12 does.
- Docusaurus admonitions (`:::info`, `:::warning`) for gotchas; mermaid is enabled (`@docusaurus/theme-mermaid`); ASCII diagrams are linted by `ascii-guard` (`npm run lint:diagrams`, website/package.json:19) — keep box drawings aligned or use mermaid.
- Config examples are `config.yaml` snippets. Never document a new `HERMES_*` env var for a non-secret setting (AGENTS.md:102-108). Always show `hermes plugins enable <name>` — plugins are opt-in.
- `onBrokenLinks: 'warn'` (docusaurus.config.ts:16-21): a broken link does NOT fail the build; verify link targets yourself.
- Per-skill docs pages are GENERATED (`website/scripts/generate-skill-docs.py`, docs-site-checks.yml:44-45) — edit the SKILL.md, never the generated page.
- Plugin docs use native tool names (`terminal`, `read_file`, `patch`, `search_files`) when addressing the agent; shell utilities only in operator-facing bash blocks.

## Building the site (verification — delegate to `Agent`)

CI (`.github/workflows/docs-site-checks.yml:22-56`): `npm i -g npm@12` → `npm ci` in `website/` → `python3 website/scripts/extract-skills.py` → `python3 website/scripts/generate-skill-docs.py` → `npm run lint:diagrams` → `npm run build:fast` (= `docusaurus build --locale en`). Locally, from the worktree:

```
Agent(prompt="cd /workspace/agent/wt-<target_slug>/website && npm ci && npm run lint:diagrams && npm run build:fast > /workspace/agent/build/<target_slug>-docs.log 2>&1; report success/fail, every 'Broken link' / warning line, and the log path.")
```

Full `npm run build` renders every locale under `website/i18n/` (deploy-site.yml:174) — slow; use `build:fast`. `npm run typecheck` checks `sidebars.ts` + `docusaurus.config.ts`. The root `npm install` installs the JS workspaces (`apps/*`, `ui-tui`, `web`, `tests-js`, package.json:6-12) — not needed for docs. Never run `npm` inline; if `npm ci` cannot reach the registry through the proxy, report the docs build as unverified rather than skipping the lint.

## What to document for a plugin change

1. Developer-facing page (or section in an existing guide): install (`hermes plugins install <owner/repo> --ref <40-char SHA>`, or copy into `~/.hermes/plugins/<name>/`), `hermes plugins enable <name>`, the manifest, config keys under `plugins.entries.<name>.settings`, hooks/tools/middleware registered, `hermes plugins doctor <dir> --ci` as the validation step, and the plugin's data dir under `<HERMES_HOME>/plugin-data/<name>/`.
2. If a CORE-CHANGE added a hook or ctx method: extend the hook table in `plugins/index.md` (923-951) and `user-guide/features/hooks.md`, and restate the additive rule (new payload data arrives as keyword fields; callbacks take `**kwargs`) from the compat contract (107-163).
3. `website/sidebars.ts` entry; add a row to the interface map in `plugins/index.md:12-20` only for a genuinely new pluggable interface.
4. Architectural decisions: append a dated entry to `docs/ADR.md` in its existing shape. The coworker ADR under `/workspace/agent/reports/` stays the working document and is not committed to the fork.

## Commit

`docs(<scope>): <description>` (CONTRIBUTING.md:944-969); same branch/PR as the code it describes; docs-only work uses a `docs/<description>` branch (919-927). Stage only `website/docs/**`, `website/sidebars.ts`, `docs/**` — never `website/build/` or `node_modules/`.

## From project

- `website/docs/developer-guide/plugins/index.md:1-20, 107-163, 181-198, 923-951`; `website/docs/developer-guide/terminal-environment-plugin.md:1-12`; `website/docs/developer-guide/contributing.md:1-9`; `website/docs/user-guide/features/{plugins,built-in-plugins,hooks}.md`
- `website/sidebars.ts:86-90, 777-797`; `website/docusaurus.config.ts:16-21`; `website/package.json:5-19`; `website/README.md`
- `.github/workflows/docs-site-checks.yml:22-56`; `.github/workflows/deploy-site.yml:162-175`; `package.json:6-12`
- `docs/ADR.md:1-40`; `AGENTS.md:102-108, 800-824`; `CONTRIBUTING.md:128-135, 919-927, 944-969`
