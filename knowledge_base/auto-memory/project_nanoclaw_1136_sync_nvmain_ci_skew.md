---
name: project_nanoclaw_1136_sync_nvmain_ci_skew
description: "PR slang-coworkers/nanoclaw#1136 (nv-main upstream sync, 2026-08-06) — handled INLINE (~29th instance). Two NEW mechanisms measured: nv-path-guard flags DELETIONS of never-allowlisted paths, and ci.yml's composed-state merge MANUFACTURES a package.json/pnpm-lock skew that reds every nv-main PR."
metadata: 
  node_type: memory
  type: project
  originSessionId: 3ae3be2a-17e7-4f5f-9f56-e631d8b51b44
---

# nanoclaw#1136 — nv-main upstream sync, 2026-08-06

**ROUTING: handled INLINE by Main — ~29th instance of the standing rule.** NanoClaw
platform-infra fork; the webhook task string ("route it to the project's `*-pr-approver`
coworker (never a reviewer/fixer)") targets PRODUCT (slang/slangpy) PRs. **No
`nanoclaw-pr-approver` exists**; no `nanoclaw-reviewer` is wired. No dispatch, no
re-review, no merge, no GitHub write. See [[project_nanoclaw_1086_sync_sendmessage]],
[[feedback_nv_coworkers_automerge]] (my merge authority is branch-scoped to
`nv-coworkers` and **explicitly excludes `nv-main` and all `sync/upstream-*` PRs**).

## Measured state at head `1e498ed2` (base `8d108b2f` = current `nv-main` tip, not stale)

- 2 commits, **14 files, +2 −1606** — a near-pure skill-deletion sync of upstream
  `743e32df` *"chore(skills): remove stale qodo and Google MCP skills (#3172)"*.
- `mergeable: true`, `rebeasable: true`, **`mergeable_state: "unstable"` = failing CI,
  NOT conflicts.** ⭐ Do not read `unstable` as a conflict — memory's prior nv-main sync
  conflict was on version pins; **this PR touches ZERO build files** (filter over
  `^container/|^\.github/|package\.json$|bun\.lock|pnpm-lock|^src/index\.ts$` → `[]`).
  The `ARG CLAUDE_CODE_VERSION=2.1.154` / `BUN_VERSION=1.3.12` lines in the patch are all
  `-` lines *inside deleted skill markdown* — prose documenting Dockerfile edits, not pins.
- Predecessor **#1086 merged 2026-08-05T14:27:43Z**, merge commit `3a873213` with
  **`parents|length == 2`** ⇒ the "Create a merge commit" method the PR body requires was
  honored. Branch `sync/upstream-nv-main` is **reused by design** (script accumulates into
  one PR per branch), so a fresh PR on the same head is not a duplicate. #1136 is the sole
  open non-draft PR into `nv-main`.

## ⭐⭐ NEW MECHANISM 1 — nv-path-guard flags DELETIONS of files nv-main never owned

`check` (nv-path-guard.yml, step #5 `python3 .github/nv-path-guard/check.py nv-main <sha>`)
**failed**, exactly as [[project_nanoclaw_pr874_webhook_route_approver]] predicts:

```
PR touches 6 file(s) outside nv-main's owned-path allowlist:
  .claude/skills/get-qodo-rules/{SKILL.md,references/{output-format,pagination,repository-scope}.md}
  .claude/skills/qodo-pr-resolver/{SKILL.md,resources/providers.md}
```

Allowlist `.github/nv-path-guard/nv-main.txt` (192 lines) — `grep -niE 'qodo|gcal|gmail'`
→ **none**. The `add-gcal-tool`/`add-gmail-tool` deletions in the same PR pass only because
line 116 carries `.claude/skills/add-*/**`; the two qodo skills match no pattern.

⇒ ⭐⭐ **The guard is path-based, not intent-based: an UPSTREAM REMOVAL of files nv-main
never owned trips it just as an unauthorized addition would.** A sync PR can be red on the
guard while its diff adds nothing — so "guard failed" is not evidence the fork is touching
territory it shouldn't. Green requires an allowlist entry (or a policy call), i.e. a write
to a file the guard itself governs.

## ⭐⭐⭐ NEW MECHANISM 2 — ci.yml's composed-state merge MANUFACTURES the lockfile skew

`ci` failed at step #8 `pnpm install --frozen-lockfile`:

```
ERR_PNPM_OUTDATED_LOCKFILE  ... specifiers in the lockfile don't match package.json:
* 1 dependencies were added: ccusage@20.0.19
```

**#1136 touches neither `package.json` nor `pnpm-lock.yaml`.** Traced instead to `ci.yml`
step #3, which merges all `nv-*` branches to test the composed state:

- `ccusage@20.0.19` lives in **`nv-dashboard`**'s `package.json` (commit `c7d5752d`,
  2026-08-06T14:21, PR #1122); its lockfile has 21 `ccusage` refs.
- The merge step resolves the lockfile conflict by rule — log:
  `##[notice] nv-dashboard: pnpm-lock.yaml conflict — taking HEAD (canonical) version`
  (nv-main's lockfile, **zero** `ccusage`) — while `package.json` **auto-merges cleanly**
  (`Auto-merging package.json`, no conflict) and absorbs the `ccusage` line.

⇒ ⭐⭐⭐ **A per-file conflict policy applied to a package.json/lockfile PAIR fabricates a
state that exists on no branch.** Take-HEAD on the lockfile + clean auto-merge on the
manifest = guaranteed `--frozen-lockfile` failure. **Pre-existing and PR-independent: it
reds EVERY PR into `nv-main` until nv-dashboard's two files agree.** Fix belongs in
nv-dashboard's tree (or in the merge policy), not in any sync PR.

⚠️ **All 21 steps after #8 SKIPPED** ⇒ format/typecheck/tests **never ran**. This PR has
**no test signal at all** — "2 of 4 checks red" understates it; the two green ones are
`label` and `guard`, neither of which executes code. A skipped step is not a passing step
([[feedback_green_job_skipped_backend_…]] family).

## `verify` correctly absent — two independent reasons, both measured

`verify` (verify-agent-image.yml) is not among the 4 workflow runs at the head sha. It
carries `if: github.base_ref == 'main'` **and** `paths: [versions.json]`, which #1136 does
not touch. ⚠️ [[project_nanoclaw_1086_sync_sendmessage]] warns that my earlier
`read_pin`/`pipefail` root cause for a past `verify` red was **INFERRED, never confirmed,
and is now moot** — do not restate it.

## Position

Reported inline to the operator: not conflicted, correct topology, zero build-file risk;
blocked on (1) a `nv-main.txt` allowlist entry for the two qodo skill paths, (2) the
nv-dashboard `ccusage` manifest/lockfile skew. Merge is the maintainer's (szihs). No
GitHub comment posted — no durable authorization to write on `nv-main` sync PRs, and
memory records bot `addComment` on this repo as needing a live check rather than an
assumption ([[project_nanoclaw_pr864_sync_blocked]]).

**RESUME** if: the operator authorizes the allowlist edit or the nv-dashboard lockfile
fix; or a later nv-main PR shows the same `ccusage` error (⇒ #1122's skew still unfixed);
or a sync PR trips the guard on deletions again (⇒ propose a policy change, not a
per-PR allowlist patch).
