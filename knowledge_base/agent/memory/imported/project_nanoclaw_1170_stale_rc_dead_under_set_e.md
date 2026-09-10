---
name: project_nanoclaw_1170_stale_rc_dead_under_set_e
description: "nanoclaw#1170 (szihs) — fix1 (pnpm `--` filter) verified by execution; fix2 P1: `STALE_RC=$?` after a bare command is DEAD under `set -euo pipefail` (line 18), so the new rc=2 message never prints AND the pre-existing correct rc=1 message was silenced. 29/29 tests pass with both branches dead. MERGED mid-review; blobs identical on nv-main."
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1170
---

# `slang-coworkers/nanoclaw#1170` — "staleness: accept pnpm's `--`, and stop reporting a crash as a finding"

Author **szihs**, branch `fix/nv-main/staleness-arg-and-rc` → `nv-main`. Head `487ceeef`,
2 files, +37/−7. Direct follow-up to [[project_nanoclaw_1161_runner_src_staleness]] (both bugs
found by lego's first real deploy run). Review comment **`5237911756`**.

**Routing: handled INLINE — ~6th/33rd instance of the standing rule.** `pr_ready_for_review`
carried the generic *"route to the project's `*-pr-approver`"*; destinations hold only
`slang-pr-approver` / `slangpy-pr-approver`, both **compiler** approvers that would
`ABSTAIN_POLICY` on a NanoClaw-platform PR. See [[project_nanoclaw_pr874_webhook_route_approver]].

⛔ **MERGED 2026-08-10T08:37:23Z by szihs (`378b148e`) while I was reviewing** — 6th mid-review
merge on this repo. ✅ Both changed blobs **byte-identical on `nv-main` after the merge**
(`setup/merge-train.sh` `f0981e36`, `scripts/check-agent-runner-staleness.ts` `4d1fea1e`), so every
finding is live in production code.

## ✅ Fix 1 (the `--` filter) verified, root cause reproduced

Real pnpm really forwards the separator — proven with a throwaway `argecho` script, not by reading:
`pnpm run argecho -- --refresh` → `ARGV: ["--","--refresh"]`; without the separator → `["--refresh"]`.

Checker executed at **both ends**: `-- --refresh` gives `unknown argument(s): --` rc=2 at `pr1170^`
and rc=0 at head. Filter correctly scoped — `--bogus` still rc=2, and `-- --bogus` still rc=2, so
stripping the separator does not swallow a genuine error. Also fine: `--refresh --`,
`-- -- --refresh`, `--refresh --json --`.

## 🔴 P1 — `STALE_RC=$?` is unreachable; the fix silenced the message it replaced

`setup/merge-train.sh:18` is `set -euo pipefail`, so the bare `pnpm run check:runner-staleness`
at `:249` **terminates the script**; `STALE_RC=$?` at `:250` never runs and neither branch
(`:251`, `:256`) is reachable. Matrix run on the **live nv-main blob** (267 lines) with a stubbed
checker, rc=0 as positive control:

| checker rc | pre-PR script | merged script |
|---|---|---|
| 0 | rc 0, prints `done — …` | rc 0, prints `done — …` ✅ control fires |
| 1 | rc 1, **prints** "some groups still run stale…" | **rc 1, prints NOTHING** |
| 2 | rc 1, prints that same (wrong) message | **rc 2, prints NOTHING** |
| 3 | — | rc 3, nothing |

⭐**The regression is the interesting half:** the PR aimed to stop a false statement and instead
produced **no statement**, including on the rc=1 path that was previously correct — `exit 1` with
no stdout explaining it. Merge is still KEPT on every path (verified `origin/nv-main` remains an
ancestor of HEAD after the `set -e` abort), so damage is confined to reporting.

Remedy verified (`bash -n` clean, all four rcs on the real script):
`STALE_RC=0` / `pnpm run … || STALE_RC=$?` → rc0 done, rc1 groups message, rc2/rc3 "could not RUN".
**The repo already has the working idiom three times over**: `container/build.sh:177-179`
(`set +e`/run/`FETCH_RC=$?`/`set -e`), `scripts/fetch-skills.sh:223-225`, and
`scripts/cron-run.sh:73-74` whose comment names the exact trap
(*"an echo is enough to reset `$?`, which is how funnel-cron.sh logged rc=0 for every failure"*).

## 🟡 Zero coverage, and the one-line test that would have caught it

**29/29 tests pass on the merged head with both branches dead** (`agent-runner-staleness` 12,
`agent-runner-src-lifecycle` 7, `merge-train` 10 — executed by subagent on an isolated clone).
No test references `STALE_RC`; nothing reaches `:249`. Every executing invocation sets
`MERGE_TRAIN_NO_INSTALL=1` and returns at `:172`, and the only CI caller
(`compose-check.yml:46`) sets it too and never runs `check:runner-staleness` in any form.
`merge-train.test.ts:235-241` already pins the tail's **shape** for its neighbours precisely
because it cannot execute it — the new block got neither execution nor shape assertion.

## 🟡 Same class one frame up — `applySafeRefresh` crash lands on the wrong constant

`src/agent-runner-staleness.ts:225-235` calls `fs.mkdirSync`/`fs.copyFileSync` with no try/catch and
there is no top-level handler ⇒ an uncaught throw exits **1** = `EXIT_STALE_FOUND`. **Constructed on
the real code** (group copy `stale`, dest dir `chmod 500`): `EACCES … at applySafeRefresh
(…:231:8)`, rc=1 — i.e. a crash *during refresh* still reports as a finding about the groups, the
exact sentence the PR header calls "a false statement dressed as a result". Not a regression from
this PR; the new constants only separate the two deliberate `return` sites. Note the file's other
I/O (`listFiles`, `sameContent`, `findGroupCopies`) is already defensive — this is the one write
path that isn't.

## Small notes posted

- `EXIT_STALE_FOUND`/`EXIT_CANNOT_RUN` are **exported but unimportable**: the module ends in
  top-level `process.exit(main(...))` (`:161`), so importing runs the check and exits the importer.
  Verified — a file logging before/after `await import()` prints only "before".
- The body's `prettier --check "src/**/*.ts"` (`package.json:21`) **covers neither changed file**
  (`scripts/**`, `setup/**` are outside the glob). Ran prettier on the changed TS directly: clean —
  so the claim holds by luck, not by the cited command.
- Cited `ok: 16 diagnostic(s), 12 baselined, no drift` not executable on this edge (borrowed
  `node_modules` lacks `@types/js-yaml` + `@chat-adapter/telegram` ⇒ 3 unrelated env errors).
  Reconciled arithmetically instead: 19 total − 3 env = 16 parsed, all 12 baseline entries at exact
  counts. Consistent with the tree.

## Instrument failures inside this review (both caught, see leaves)

1. ⛔ A sibling session **pruned my `git worktree` registration** mid-review (`wt-1171` /
   `wt-1171-base` remained; my `tree1170` vanished) → `git show` failed → I ran an **empty** script
   and read `SCRIPT_RC=0`, which would have inverted the P1. Caught by the missing 267-line output.
   Redone from an isolated clone with a positive control. See
   [[feedback_a_pruned_worktree_makes_git_show_a_silent_empty_file]].
2. ⛔ My `git --git-dir=<shared>/.git --work-tree=<scratch> checkout` wrote the **shared clone's**
   file into the scratch tree — the reflexive-restore move
   [[feedback_tracked_mods_on_a_shared_clone_is_a_reading_not_a_state]] warns about. Shared clone
   audited clean afterward (only a pre-existing untracked `scripts/scrub_kb_pii.py`).

## Posting mechanics

⚠️ **`gh pr comment` failed** — `GraphQL: Resource not accessible by integration (addComment)`,
and `gh auth status` says *"The token in GH_TOKEN is invalid"* — yet the same token reads fine and
reports `{"admin":true,...,"push":true}`. **REST `POST /issues/1170/comments` succeeded** (id
`5237911756`, verified 7802 bytes live). See [[feedback_gh_pr_comment_graphql_fails_where_rest_succeeds]].

## Scope — not verified

That the `--` fix makes the whole lego deploy chain pass (never ran a real five-branch merge with
the Node toolchain). And whether a running container picks up a refreshed file — unchanged
limitation inherited from #1161.
