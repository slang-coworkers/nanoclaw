---
name: project_nanoclaw_1185_sync_onshutdown_breaking
description: "slang-coworkers/nanoclaw#1185 nv-coworkers upstream sync — first sync memo carrying an UPSTREAM BREAKING API removal (onShutdown -> onHostShutdown); verified by armed typecheck, MERGED 2026-08-10. Records the presence-test bug that faked a fork-edit census."
metadata:
  node_type: memory
  type: project
  originSessionId: bc9dbdbe-95ac-471c-9606-5165681f3bb8
---

# nanoclaw#1185 — nv-coworkers upstream sync, 2026-08-10 (MERGED)

**Handled INLINE by Main (~30th instance).** Webhook task said "route to the project's
`*-pr-approver`" — there is **no `nanoclaw-pr-approver`**; that string targets PRODUCT
(slang/slangpy) PRs. Same class as [[project_nanoclaw_1136_sync_nvmain_ci_skew]],
[[project_nanoclaw_1137_sync_nvcoworkers_qodo_gmail_removal]]. Merge authority:
[[feedback_nv_coworkers_automerge]] (nv-coworkers-scoped, covers `sync-upstream.sh` PRs).

**MERGED 2026-08-10T21:50:49Z**, `merge_method=merge` (PR body requires a merge commit to
preserve upstream parent links). Merge commit `becd4d94d`, **`parents|length == 2`**
(`a095beb50`, `8ff83e852`) — method honored. `nv-coworkers` tip = `becd4d94d`.

## Measured state at head `8ff83e852`

- 14 commits (6 upstream non-merge), **19 files, +845 −62**. Second parent `86e353564`
  (upstream `nanocoai/nanoclaw` merge of PR #3216). `743e32df` (last sync point) **is an
  ancestor** of it ⇒ forward sync, no history rewrite.
- `mergeable_state: clean`. One check: `label completed success`. **No CI gate** — `ci.yml`
  is `on: pull_request: branches: [main]` only. `nv-path-guard` does **not exist on
  nv-coworkers** (nv-main-only), so the #1136 guard mechanism cannot fire here.
- Upstream authors genuine: Zvi Fried (×5), Alfred Lorber (×1). Zero files under
  `knowledge_base/`, `.env`, `groups/`, `data/`, no pem/secret. **Zero build manifests**
  touched (`package.json`/`pnpm-lock`/`bun.lock`/Dockerfile) ⇒ none of the #1136 composed-state
  lockfile-skew exposure.

## ⭐⭐ This sync carried an UPSTREAM BREAKING CHANGE — a first for these memos

`CHANGELOG.md` marks it `[BREAKING]`: `onShutdown()` / `getShutdownCallbacks()` **removed**
from `src/response-registry.ts`, replaced by `onHostShutdown()` / `startHostModules()` /
`stopHostModules()` in new `src/host-lifecycle.ts`. Upstream ships
`docs/host-lifecycle-migration.md` with the cutover.

⇒ ⭐⭐⭐ **A no-CI-gate branch plus a breaking API removal means the ONLY verification is a
typecheck at the merged head.** Prior sync memos got away with diff-shape reading because the
syncs were additive or pure deletions; **shape reading cannot see a dangling caller.**

**Delegated typecheck (worktree at `8ff83e852`, symlinked host `node_modules`):**
- Host `tsconfig.json` (`include: src/**/*`): **PASS, exit 0, 0 errors**, 496-file program,
  220 under `src/`.
- ✅ **Instrument armed by positive control**: a probe importing the removed symbols produced
  `TS2305 ... has no exported member 'onShutdown'` + exit 2; removed → exit 0. So tsc *would*
  have caught a stale caller and found none. This also independently confirms the removal is
  real at that commit.
- Repo-wide grep: **0** remaining `onShutdown`/`getShutdownCallbacks` call sites; all 5 live
  sites use the new API (`src/index.ts:17,153,174`, `src/modules/approvals/index.ts:26,44`).
- ⚠️ **Unverified surfaces, stated not glossed:** `container/agent-runner/` typecheck is
  **SKIPPED-missing-deps** (`TS2688` for `@types/bun`; that tree has no `node_modules`) — 11
  errors under `--types node` all trace to uninstalled modules, none to this API. Host
  tsconfig's `include` is `src/**/*` only, so `scripts/`, `setup/`, `vitest.config.ts` were
  **not covered by either run**. All three surfaces contain zero references to the changed API.

## Why the merge surface was tiny (and how to measure it)

Fork-side divergence in `src/`+`container/` since the last sync point `743e32df` was **exactly
1 file** (`src/host-sweep-grace.test.ts`, *deleted* on the fork by `63f38e3d` "remove obsolete
justWoke grace-period test (#859)"). Absent at base and at merged head ⇒ the merge did not
resurrect it. All 19 PR files are **blob-identical to upstream `86e353564`** and carry
**zero fork edits** since the last sync point (7 are new-from-upstream).

## ⛔ INSTRUMENT DEFECT — `git rev-parse` fakes a diff for absent paths

My first fork-edit census printed `FORK_EDIT_SINCE_LAST_SYNC` for 7 files that were simply
**new from upstream** (absent at both revs). Cause: `git rev-parse "$rev:$path"` on a missing
path **writes the argument string to stdout** and exits non-zero, so `$(...)` captured two
*different* error strings (`a095beb50:src/host-lifecycle.ts` vs `743e32df:src/host-lifecycle.ts`)
and the `!=` test fired. **Absent-vs-absent compared as changed.**

⇒ ✅ **Gate every rev:path read on `git cat-file -e "$rev:$path"` first**, and classify the
absent case explicitly (`NEW_FROM_UPSTREAM` vs `NO_FORK_EDIT` vs `REAL_FORK_EDIT`). ⭐⭐ The
defect **failed toward finding work** — it manufactured 7 phantom fork edits, the same
direction as the phantom-dark-files instrument in [[technique_keeping_this_store_reachable]].

⛔ **And my first positive control was VOID, not passing:** I picked
`.github/nv-path-guard/nv-coworkers.txt`, which **does not exist on this branch** — it printed
`NO_FORK_EDIT` with `b=ABSENT`, i.e. the control was reporting the very bug it was meant to
catch. A real control (`.github/workflows/verify-agent-image.yml`, genuinely fork-edited)
printed `REAL_FORK_EDIT` and armed the census. ⇒ ⭐⭐⭐ **A control on a path you did not verify
exists is indistinguishable from a control that passes.** Cf.
[[feedback_a_control_validates_the_instrument_never_the_target]].

⚠️ Also cost me two empty results mid-session: **the Bash tool resets cwd between calls**, so
`git ls-tree` from `/tmp` returned "not a git repository" — which reads identically to "the
directory is empty". Re-ran with an explicit `cd /workspace/agent/pr1175 &&`.

Related: [[feedback_a_resync_merge_hides_edits_behind_a_legitimately_large_delta]] (the
per-hunk-provenance discriminator; here the stronger blob-identity form was available because
every file was wholly upstream's).
