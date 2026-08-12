---
name: project_nanoclaw_1191_sync_remote_http_mcp
description: "slang-coworkers/nanoclaw#1191 nv-coworkers upstream sync — carries upstream remote Streamable-HTTP-MCP feature (#3092) + Tavily skill (#3190); handled INLINE (~31st instance), MERGED 2026-08-11. Pure forward sync (behind_by:0) eliminated the #1185 dangling-caller risk without a typecheck."
metadata:
  node_type: memory
  type: project
  originSessionId: pr1191-webhook
---

# nanoclaw#1191 — nv-coworkers upstream sync, 2026-08-11 (MERGED)

**Handled INLINE by Main (~31st instance).** `Sync nv-coworkers with upstream/main`,
`sync/upstream-nv-coworkers` → **`nv-coworkers`**, author `nv-slang-bot[bot]`
(`sync-upstream.sh`). Webhook task "route to the project's `*-pr-approver`" — **no
`nanoclaw-pr-approver` exists**; the string targets PRODUCT (slang/slangpy) PRs. Same class
as [[project_nanoclaw_1185_sync_onshutdown_breaking]],
[[project_nanoclaw_1137_sync_nvcoworkers_qodo_gmail_removal]]. Merge authority:
[[feedback_nv_coworkers_automerge]] (nv-coworkers-scoped, covers `sync-upstream.sh` PRs).

**MERGED 2026-08-11**, `merge_method=merge` (PR body requires a merge commit to preserve
upstream parent links). Merge commit `60df8bdcb`, **`parents|length == 2`**
(`e5a03761e` = prior nv-coworkers tip, `d4bbc007c` = PR head) — method honored.
`behind_by:1` post-merge = the merge commit itself, not a real lag.

## Measured state at head `d4bbc007c`

- 6 commits (5 upstream non-merge), **28 files, +1166 −114**. `mergeable: clean`.
- ⭐ **Pure forward sync: `behind_by: 0`, `merge_base == base_commit == nv-coworkers tip`
  (`e5a03761e`).** Head is strictly nv-coworkers + 6 upstream commits → ZERO fork
  divergence on any touched path. This is what eliminated the #1185 dangling-fork-caller
  risk *without* a merged-head typecheck: every changed file is wholly upstream's, already
  passed upstream CI as a self-consistent set, and no fork-local caller can dangle when the
  fork never edited these paths.
- Genuine upstream authors: Amit Shafnir (×4, [REDACTED-EMAIL]), Mani (tavily.com). Zero
  files under `knowledge_base/`, `.env`, `groups/`, `data/`, no pem/secret.
- One check: `label completed/success`. Combined status `pending/total:0` (no legacy
  statuses). **No CI gate** — `ci.yml` is `on: pull_request: branches: [main]` only; a
  nv-coworkers PR never runs CI. (`nv-path-guard` is nv-main-only, does not fire here.)

## What the sync carries (upstream #3092 + #3190)

Remote **Streamable HTTP MCP servers**. `McpServerConfig` in
`container/agent-runner/src/providers/types.ts` changed from a struct to a union
(`{type?:'stdio';command;args?;env?} | {type:'http';url}`). New exports
`parseMcpServerConfig` / `validateMcpServerName` land in `src/container-config.ts`
(+108/−1) and are imported by `src/modules/self-mod/request.ts` (+62/−47, net-negative =
removal of local `isStringArray`/`isStringRecord` guards, replaced by the shared parser) —
so the new imports resolve **within the same PR**. Plus `add-tavily-tool` skill (new, 4
files), tests across self-mod/container-config/templates/groups, and doc updates. CHANGELOG
adds ONE new line (the non-breaking remote-MCP feature); the two `[BREAKING]` lines are
pre-existing context already synced in #1185 (`onShutdown`, hardened-image).

**No GitHub comment posted** — self-verified bot sync PR merged same turn, no human awaiting
a note; bot `addComment` on this repo needs a live check anyway. **On webhook redelivery:
terminal (merged). Do not re-verify, do not route.** Repo auto-deletes head branches on
merge; next daily run opens a fresh PR number.
