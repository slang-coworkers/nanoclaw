---
name: project_nanoclaw_1127_clone_refresh_lock
description: "nanoclaw#1127 (szihs) locks the clone refresh + replaces FETCH_HEAD with an own completion stamp. Reviewed INLINE (7th no-nanoclaw-approver instance), comment 5206011378. MERGED 14:04:45Z mid-review (6th merge-race). Core claim CORROBORATED by real-git differential. 2 🟠 + 1 🟡; my in-process 'both acquired' race was an INJECTED-CLOCK ARTIFACT — 120 real boots gave 1 winner every time."
metadata:
  node_type: memory
  type: project
  originSessionId: c2e69b60-c9b3-4351-81d9-384c2d923a3b
---

# nanoclaw#1127 — lock the clone refresh; stop `FETCH_HEAD` masking a partial one

PR https://github.com/slang-coworkers/nanoclaw/pull/1127, author **szihs**, base **`nv-main`**,
head `5c4d3ca1d648c102480960c20127e31b8d284c8d`, 3 files **+422/−45**:
`container/agent-runner/src/{index.ts,refresh-clones.ts,refresh-clones.test.ts}`.
Merge-base `e81a0cc76`. My comment **`5206011378`**. Fixes **F16** (#918).

**Routing: INLINE by Main. 7th instance** of the standing rule — webhook again carried the generic
*"route to the project's `*-pr-approver`"* string, which targets slang/slangpy PRODUCT repos.
See [[project_nanoclaw_pr874_webhook_route_approver]].

## ⛔ MERGED MID-REVIEW — 6th merge-race in this series

`mergedAt=2026-08-06T14:04:45Z`; opened 13:56:23Z. On arrival `state=OPEN`, `ci` IN_PROGRESS.
Merge-race count now **SIX** (#1066/#1068/#1071/#1075/#1078/#1127). ⇒ Findings reframed as
follow-up material, not a merge gate. **The pre-post recheck is what caught it and stays mandatory**
(`gh pr view --json state,mergedAt` immediately before POST). ⚠️`--json merged` is NOT a field —
use `mergedAt`.

## Core claim CORROBORATED — the real-git run the author said they could not do

The author explicitly scoped out "not run against a real remote". I built that fixture, and it is
the only test that demonstrates base-fails/head-passes for the shared logic.

**Fixture that makes the pull succeed and ONLY the submodule fail** (the non-obvious part): upstream
advances `f.txt` *and* adds a submodule whose `.gitmodules` URL doesn't resolve.
⚠️**First attempt FAILED to isolate**: pointing the *existing* submodule's remote at a dead path made
`git pull` itself fail — because `fetch.recurseSubmodules=on-demand` is git's DEFAULT, so a broken
submodule remote fails the PULL, not the submodule step. Had to add a NEW submodule with a bogus URL
so only `submodule update --init` fails.

| | boot 1 | disk after | boot 2 (+1s, inside TTL) |
|---|---|---|---|
| base `e81a0cc` | logs `Clone refresh skipped` | `head=32b5d02 f=v2` advanced, `sub/x.txt` MISSING | `refreshed=[] log=[]` — **SKIPPED** |
| head `5c4d3ca` | logs `submodule update FAILED … not stamped` | identical partial state | attempts `[pull,submodule]` — **RETRIED** |

`FETCH_HEAD=true / our-stamp=false` after the partial boot is the entire bug + fix in one line.
Both author claims verified too: `Bun.YAML` — `scaffold.test.ts` **4 pass** on bun 1.3.12 (author had
1.2.19, CI pins 1.3.12), and git tolerates our artifacts in `.git` (`fsck`/`gc`/`status --porcelain`
all clean with lock dir + stamp present; `gc` does not reap the lock).

## 🟠1 — the mechanism the author calls "the part that actually fixes defect 1" is UNTESTED

Mutation battery (delete each guard, run the 19 shipped tests):

| mutation | result |
|---|---|
| **remove in-lock re-check** | **19 pass / 0 fail** |
| **remove outer pre-check** | **19 pass / 0 fail** |
| remove lock acquisition | 18/1 · stamp-despite-submodule-fail 17/2 · stamp-despite-pull-fail 18/1 |
| stale-break drop age check | 16/3 · invert age cmp 15/4 · releaseLock no-op 16/3 · invert TTL 18/1 |

Every guard pinned EXCEPT both recency checks. Instrumented which branch excludes the 9 contenders
in the author's concurrency test: **`excluded-by-LOCK=9, excluded-by-RE-CHECK=0`** — the 9 are
refused because boot 1 still *holds* the lock (it re-enters mid-pull), so they never get inside it.
The re-check's real window is: B passes pre-check → A completes and **releases** → B acquires →
re-check sees fresh stamp. Nothing reaches that ordering. Test gap, not a code defect.

## 🟠2 — the stale-lock break is ITSELF check-then-act (the pattern the PR removes)

`acquireLock` break path = `stat`(judge stale) → `rmSync` → `mkdirSync`. Two boots both judging one
orphan stale can both pass the age test; the loser's `rmSync` deletes the WINNER's live lock.

⛔**I could NOT make it fire, and said so with numbers.** 15 real processes vs a genuinely
11-min-old orphan (`os.utime` −660 s), gate-synchronised, real `Date.now()`, 8 trials =
**120 boots, exactly 1 winner every time**. Then 40 boots × 3 trials with the branch instrumented:
**BREAK path entered by exactly 1 boot per trial** (39 refused). Damage also bounded — two concurrent
`git pull --ff-only` on one clone both `rc=0` with a correct tree (git's own `index.lock`), so worst
case is duplicated remote traffic, not corruption. Remedy if wanted: `mkdir` unique + `rename` into
place, or write pid and re-read to confirm ownership.

## 🟡3 — `releaseLock` swallows its failure ⇒ silent 10-minute refresh outage

Unwritable `.git` between acquire and release ⇒ bare `catch` drops the error, lock **leaks**,
**no log line mentions it**, next boot `pulls=0` (blocked), recovers only past `LOCK_STALE_MS`.
The comment claims *"broken by the next boot"*; it's broken 10 minutes later. One `log()` fixes it.

## Suite attribution — author's "1 fail" was stale; PR adds NOTHING

Author measured at `e81a0cc`; `nv-main` had moved to `71c24beb`. Merged onto current tip (clean):

| tree | result |
|---|---|
| `nv-main` alone | 355 pass / 1 skip / **3 fail** |
| `nv-main` + PR | 367 pass / 1 skip / **3 fail** |

Same 3, all `poll-loop.test.ts` › *critique-gate text-output integration (#67)* — **pre-existing on
`nv-main`**, none attributable. `refresh-clones.test.ts` 19/19 on the merged tree. Separately worth
flagging: nv-main carries 3 genuine failures right now.

Also: head tests vs base source is a **compile** failure (`Export named 'REFRESH_LOCK' not found`),
not 7-vs-19 behaviour — the author's cited differential proves less than it appears to.

## Instrument traps hit this session

- ⛔**Symlinked `node_modules` from `nanoclaw-kb` (a DIFFERENT commit) into the worktrees.** Produced
  13 fail / 10 errors that vanished on nanoclaw-kb's own tree. `package.json`/`bun.lock` were
  identical between the commits, so deps weren't the cause — the poll-loop SOURCE differs by
  ~2800 lines between merge-base and kb HEAD. Attributed correctly only by running base and head
  under the *same* link and seeing identical counts. See [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] family.
- ⚠️**A bare worktree gives a FALSE `TS2688 Cannot find type definition file for 'bun'`** — typecheck
  only inspects the file once `node_modules` exists. Empty tsc output on a depless tree proves nothing.
- ⛔**My probe "both boots acquired the lock" was an INJECTED-CLOCK ARTIFACT**, exactly the trap the
  author documents at `refresh-clones.test.ts:79-83`. Retracted before posting via the real-clock run.
- ⛔**A probe that pre-created the stamp AS A DIRECTORY never reached the stamp-write path** — the
  OUTER pre-check stat()'d it and skipped. Its `pulls=0` looked like a stamp-mask regression; the real
  cause was the 🟡3 lock leak. Isolated before publishing.

## Write path

REST issue-comment worked: `gh api repos/.../issues/1127/comments --method POST -F body=@file` →
`5206011378`. Consistent with [[project_nanoclaw_1067_footer_normalizer]] (both `gh pr` wrappers
denied on this repo, REST works).

## Related

[[project_nanoclaw_1114_gc_build_size_accounting]] (6th inline instance; same pre-post recheck) ·
[[project_nanoclaw_1067_footer_normalizer]] (write path) ·
[[feedback_mechanism_must_predict_observed_coordinates]] (an over-stated finding costs more than a
missed one — why 🟠2 ships with its own negative result).
