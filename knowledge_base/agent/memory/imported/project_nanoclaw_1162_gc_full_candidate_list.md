---
name: project_nanoclaw_1162_gc_full_candidate_list
description: "nanoclaw#1162 (szihs) implements the 🔴2 I posted on #1114 — select() returns every eligible build, projection becomes an annotation. Reviewed INLINE (7th no-nanoclaw-approver instance), comment 5236483310, MERGED mid-review. Differential-confirmed 28/OK vs 2E+1F. 1 🔴: the unmeasured_builds fix REGRESSES against the %.1f producer."
metadata:
  node_type: memory
  type: project
  originSessionId: gc-full-candidates-1162
---

# nanoclaw#1162 — worktree GC hands over every eligible build

PR https://github.com/slang-coworkers/nanoclaw/pull/1162, author **szihs**, base **`nv-main`**,
head `4ecca738c30ddd317c22a94399eefa55e9c111db`, base `fe6b3ce98fe5842b57572e9d7ecc88c244dfce84`,
3 files **+86/−8**: `container/skills/supervise-issues/{reference.md,scripts/worktree-gc.py,scripts/test_worktree_gc.py}`.
My review comment **`5236483310`**. Labelled **F17** by the author; the owner ruled it must-fix.

**This PR is the fix for 🔴 2 that I posted on [[project_nanoclaw_1114_gc_build_size_accounting]]**
(comment 5205310610) — the projection gating list MEMBERSHIP while `reference.md` told the executor to
stop on measured `df`. It also picks up my 🟠 4 (`unmeasured_builds` conflating never-measured with
measured-as-0). Modifies my own `supervise-issues` skill ⇒ closest-to-the-state is me by construction.

**Routing: handled INLINE by Main. 7th instance** of the standing rule — the `pr_ready_for_review`
webhook again carried the generic *"Route it to the project's `*-pr-approver` coworker (never a
reviewer/fixer)"* string, which targets PRODUCT repos (slang/slangpy) only. Destination block at
review time held only `slang-pr-approver` / `slangpy-pr-approver`; no nanoclaw approver is wired.
See [[project_nanoclaw_pr874_webhook_route_approver]].

## STATE — MERGED MID-REVIEW (merge-race count 5 → SIX)

`merged_at 2026-08-10T05:55:14Z` by **szihs**, merge commit `73b5ec2a4947fb701fee9c18ef8610b2aeae11aa`.
My pre-post recheck caught it: arrival `state=open mergeable_state=unstable merged=false`, recheck
`merged=true state=closed`, ~9 min later. **`head` SHA never moved** (`4ecca738` both times) ⇒ every
finding is against merged content exactly, and the comment was framed as follow-ups not blockers.
⭐ The mandatory pre-post recheck is what let me state that rather than guess it. Prior races:
#1066/#1068/#1071/#1075/#1078.

CI all four green at review time (`ci` 2m59s, `check` 6s, `guard` 7s, `label` 5s). ⚠️ `ci` was
**`pending` on arrival** and went green during review — *pending on arrival is not a finding*.

## Differential run — I executed all three trees

| run | result |
|---|---|
| head tests on head script | `Ran 28 tests` **OK** |
| head tests on **base** script | **2 errors + 1 failure** — `KeyError: projected_sufficient_count` ×2, `unmeasured_builds: 2 != 1` |
| base tests on base script (control) | `Ran 26 tests` OK |

Byte-identical to the PR body's claim. The new tests DO pin the fix. Replacing
`test_reclaim_stops_once_target_met` (asserted `reclaim_count == 4`, i.e. pinned the defect as
intended behaviour) rather than keeping it is correct, and the body says so.

⭐ **The author's own `git stash` confession is the reusable bit**: `git stash` reverts the *tests*
along with the source, so a "pre-fix" run measures the OLD suite against the OLD code and passes for
the wrong reason. Same false-evidence shape as my fixture-too-small error on #1114. Recording it in
the commit message beats redoing it silently.

## 🔴 The `unmeasured_builds` fix is right in isolation and REGRESSES against the documented producer

The one finding that matters, and it is an **interaction** — invisible reading the diff alone.

`build_measured()` (`worktree-gc.py:104`) now accepts `0.0` as a genuine measurement. Correct in
principle. But the documented producer **cannot emit the difference**: the discovery snippet at
`reference.md:244` prints `printf "%.1f\t%.1f\t%s", t/1048576, b/1048576, d` — `%.1f` of GB quantizes
at 102.4 MiB, so a real 40 MiB build (`40960` KiB → `0.0390625`) prints **`0.0`**, byte-identical to
absent. Measured, feeding the snippet's own output to both trees:

```
build_size_gb = 0.0
  BASE: reclaim_gb=0.0  unmeasured_builds=1  → operator warned "reclaim_gb understates": YES
  HEAD: reclaim_gb=0.0  unmeasured_builds=0  → warned: NO
```

⇒ for the one input class where `reclaim_gb` genuinely understates, head reports it fully accounted.
`reference.md:319` promises `unmeasured_builds > 0` means `reclaim_gb` understates — **now false for
every sub-51.2 MiB build**. Root cause is the `%.1f` producer (my 🟠 1 on #1114, untouched here).
Principled fix is the producer: `%.2f`, or emit KiB and divide in the script (the script is the
tested surface; the shell is not).

⭐⭐ **A correct split of two conflated facts becomes a regression when the only producer cannot
express the distinction.** The consumer-side fix is not wrong — it is *premature*, and it silently
retires a working warning. Ask what CAN produce each value before separating them.

## Other findings posted (2 🟠, 2 notes) — all from EXECUTION

**🟠 the summary no longer reconciles.** Base always satisfied
`free_gb + reclaim_gb == projected_free_gb`; head does not, on the PR's own fixture:
`BASE 20+24.0=44.0 ✓` / `HEAD 20+30.0 vs 44.0 ✗`. Both fields individually right (`reclaim_gb` is now
the whole list, `projected_free_gb` the prefix) but `reclaim_gb` now **overstates what the run
deletes** — the executor stops at target. Suggested a `projected_reclaim_gb`, or one doc line.

**🟠 `projected_sufficient_count == reclaim_count` means two opposite things.** Measured:
`5×6G free 20 → count=5 cutoff=4 proj=44≥40` (headroom) · `4×6G → count=4 cutoff=4 proj=44≥40`
(exactly enough) · `3×6G → count=3 cutoff=3 proj=38<40` (**even a perfect run falls short —
escalation expected**). The last two are structurally identical in the summary. `reference.md:321-323`
says "dispatch past it whenever measured free is still short" — but nothing is past it in either.
Suggested `projection_reaches_target: bool`.

**Note — the field is a COUNT; two comments call it an INDEX** (`:181`, `:207`; the break does
`projected_cutoff = i`). Arithmetic settles it: `order=[w4..w0] cutoff=4`; as COUNT prefix
`[w4,w3,w2,w1]`=24G → 20+24=44 ✓ matches published `projected_free_gb`; as INDEX through
`reclaim[4]=w0`=30G → 50 ✗. **Value is right, comments are wrong**; field name `..._count` is correct.

**Note — `select()`'s docstring (`:131-133`) still describes the removed behaviour** — "until the
PROJECTED free would reach TARGET_FREE_GB", precisely the rule the PR deletes. The 20-line inline
block below it explains the new behaviour; the docstring above contradicts it and is read first.

## Carry-forwards from #1114

**🟠 3 over-measurement: still accepted, but DECOUPLED from a dropped candidate.** `build_size_gb:999`
on a 10 G worktree still taken at face value (`proj=1001.0`). But measured with a bogus + a real
candidate: `BASE reclaim=[w_bad]` — **`w_real`'s genuine 6 G build never offered** (bogus projection
truncated the list) vs `HEAD reclaim=[w_bad, w_real]`. F17 removes that coupling as a side effect. The
`build_size_gb <= size_gb` check is still free but no longer load-bearing. ⭐ A fix elsewhere can
downgrade an open finding's severity — recheck the severity, don't re-assert it.

**Note — `has_build` STILL has no producer.** Counted at head across the whole skill:
`SKILL.md` 0 · `reference.md` 1 (payload *comment* only) · `worktree-gc.py` 3 (all consumers,
`:157`/`:161`) · `test_worktree_gc.py` 3 (fixture). Documented snippet emits 3 fields
(`size_gb`, `build_size_gb`, `dir`) ⇒ payload built from the documented path gets `has_build` falsy
and **ZERO candidates**, making every improvement in this PR unreachable that way. `bld` already knows
via `[ -d "$wt/build" ]`. Cheapest fix in the series, largest blast radius. Unchanged since #1114.

## Method notes

- `/workspace/extra/ephemeral` is **READ-ONLY on my edge** — `mkdir` there fails
  `Read-only file system`. Scratch trees go under `/workspace/agent/`. (reference.md:224 treats it as
  the *host's* writable volume; that is the supervised fleet's mount, not mine.)
- Fetched both trees by `contents?ref=<sha>` + `base64 -d` (no clone needed for a 3-file PR), then ran
  head-tests-on-base-script in a **third mixed dir** — the only combination that proves the tests pin
  the fix. `git stash` in a shared clone cannot produce this (see the author's own note).
- Write path: `gh api repos/.../issues/1162/comments --method POST -F body=@file` worked.
  ⚠️ `--field body@/path` is not file-loading syntax.

## Related

GC lineage: [[project_nanoclaw_1114_gc_build_size_accounting]] (this PR's parent finding) ·
[[feedback_always_reap_merged_worktrees]] · [[feedback_gc_resolve_slice_worktree_head_not_issue]] ·
[[project_nanoclaw_1065_reclaim_before_wake]] · [[project_workspace_deletion_incident]] ·
[[project_fleet_build_thundering_herd]].
Routing rule: [[project_nanoclaw_pr874_webhook_route_approver]].
