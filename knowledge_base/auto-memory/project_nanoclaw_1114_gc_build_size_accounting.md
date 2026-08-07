---
name: project_nanoclaw_1114_gc_build_size_accounting
description: "nanoclaw#1114 (szihs, OPEN 08-06) makes worktree GC measure build/ not the worktree. Reviewed INLINE (6th instance of the no-nanoclaw-approver rule), comment 5205310610. Differential-confirmed. 1 🔴 (projection still gates MEMBERSHIP so the new stop-on-measured walk can exhaust a truncated list) + 3 🟠. My own draft's unit-error claim was WRONG and a range check caught it pre-post."
metadata:
  node_type: memory
  type: project
  originSessionId: gc-build-size-1114
---

# nanoclaw#1114 — worktree GC measures `build/`, not the worktree

PR https://github.com/slang-coworkers/nanoclaw/pull/1114, author **szihs**, base **`nv-main`**,
head `26156573c2fe59da45e88cfbc4a59f64d63eaced`, 3 files **+170/−23**:
`container/skills/supervise-issues/{reference.md,scripts/worktree-gc.py,scripts/test_worktree_gc.py}`.
My review comment **`5205310610`**. Base at review time `e81a0cc76297e3457081c93656d1762dc06a3097`.

**This PR modifies MY OWN supervisor skill** (`supervise-issues`) — the `worktree-gc.py` whose output
drives my disk-pressure ticks. Closest-to-the-state is me by construction, not just by routing default.

## STATE — OPEN throughout; no merge race (2nd in the series to break the streak)

`state=OPEN`, `merged=null`, `mergeable_state` went `UNSTABLE`→`CLEAN`, head unchanged across
fetch → review → post. All 3 checks green (`ci`, `label`, `check`/nv-* path guard). ⚠️ `ci` was
**`IN_PROGRESS` on arrival** and went green during review — *`UNSTABLE` on arrival is not a finding*
(same as [[project_nanoclaw_1080_kb_health_route]]). Merge-race count stays at **FIVE**
(#1066/#1068/#1071/#1075/#1078); the pre-post recheck cost nothing and stays mandatory.

**Routing: handled INLINE by Main. 6th instance** of the standing rule — the `pr_ready_for_review`
webhook again carried the generic *"Route it to the project's `*-pr-approver` coworker (never a
reviewer/fixer)"* string, which targets PRODUCT repos (slang/slangpy) only. No nanoclaw approver is
wired. See [[project_nanoclaw_pr874_webhook_route_approver]].

## What the PR gets right — differential-CONFIRMED, not taken on faith

The bug: discovery reported whole-worktree `du -sh` as `size_gb`; `select()` projected free space with
it and `summary.reclaim_gb` summed it — but a reclaim deletes **only `<worktree>/build`**. So the GC
could declare `TARGET_FREE_GB` met after freeing a fraction and stop while still near ENOSPC (the
2026-07-13 fill is the incident the tier was built for). Fix carries `build_size_gb` explicitly as the
only figure the reclaim math uses.

**Differential run (I executed both trees):**
- head `test_worktree_gc.py` on head script → **26 tests OK**
- head tests on the **base** script → **5 failures + 2 errors**, the 19 classifier tests pass unchanged

⇒ the PR's own stated verification reproduces exactly, and the tests **do** pin the fix (contrast
[[project_nanoclaw_1065_reclaim_before_wake]], where the added test passed on pre-fix source).
`test_reclaim_stops_once_target_met` moving `2 → 4` is the entire bug in one assertion. The
unmeasured-counts-as-0 asymmetry argument (under-project = keep deleting; over-project = stop early)
is correct and is the right default.

## ⛔ MY OWN DRAFT WAS WRONG AND A RANGE CHECK CAUGHT IT PRE-POST

I built a fixture (41 MB build in a 51 MB worktree), ran the committed discovery snippet verbatim, got
`0.0  0.0`, and **drafted a 🔴 claiming the `/1048576` divisor was a KB→TB unit error**. Then
range-checked before posting: `du -sk` returns KiB, **6 GiB = 6291456 KiB, `/1048576` = 6.0 exactly**.
**The divisor is CORRECT.** What I actually had was `%.1f` quantization — my fixture was 100× too
small to distinguish the two hypotheses, and `0.0` is the observable for both.

⇒ ⭐⭐⭐ **A fixture sized outside the instrument's operating range cannot discriminate between
"wrong units" and "correct units, coarse format" — both print `0.0`.** Size the fixture to the real
regime (GB here) or compute the expected value by hand *before* interpreting the output. I published
the arithmetic refutation *in the review* precisely because "wrong units" is the plausible-looking
wrong review of this snippet.
See [[feedback_mechanism_must_predict_observed_coordinates]] — an over-stated finding against a
correct line does more damage than a missed one.

## Findings posted (1 🔴, 3 🟠, 2 notes) — all from EXECUTION, none findable by reading

**🔴 2 — the projection still gates MEMBERSHIP, not just ordering.** `worktree-gc.py:158` keeps
`if projected >= TARGET_FREE_GB: break`, while the new `reference.md:364-366` tells the caller to walk
the `reclaim` list re-measuring with `df` and stop on the **measured** number. The list was already
truncated by the projection it's told not to trust. Ran the PR body's own scenario (5 × 10 G worktree /
6 G build, free 20, target 40): `reclaim=[w0..w3]` 24.0 G, projected 44.0, and **`w4` (6 G build,
`has_build`, idle) is eligible STALE-OPEN but not listed**. One `active` reply ⇒ measured free 38, list
exhausted, doc says escalate — with 6 GB never offered. Re-running `select()` at `free_gb=38` does NOT
recover it: 38 ≥ `PRESSURE_GATE_GB` 25 ⇒ `under_pressure` false, `reclaim` empty. Suggested: include
every eligible candidate in idle order, let measured `df` stop the walk, projection annotates.

**🟠 1 — `%.1f` quantizes at 102.4 MiB; anything under 51.2 MiB rounds to `0.0`**, which
`build_gb()` treats as *unmeasured*. Real 3–7 GB builds report fine, so not a general breakage — but a
genuinely-small/empty `build/` lands in `unmeasured_builds` and is documented as "understates" when it
doesn't. `sort -rn -k2` sorts the ROUNDED field ⇒ sub-51 MiB ties are arbitrary. Fix: `%.2f`, or emit
KiB and divide in the script (the script is the tested surface; the shell is not).
Also flagged: the PR body's fixture figures `0.0488 / 0.0391` are arithmetically right but are **not
what the committed snippet prints** — the only part of that verification with no checkable expectation.

**🟠 3 — `build_size_gb > size_gb` is structurally impossible but accepted.** `build_gb()` rejects
negatives/bools/strings but not over-measurement: `999` → accepted 999.0, `projected_free_gb=1001.0`
published as a *lower bound*, and via 🔴2 the real 6.0 G candidate is **dropped from the list**. `build/`
is inside the worktree ⇒ `build_size_gb <= size_gb` is a free check. This is the **fifth** malformed
shape and the only one failing *toward* over-projection — the exact direction the PR exists to stop.

**🟠 4 — `unmeasured_builds` conflates never-measured with measured-as-0.** Predicate is
`build_gb(w) == 0.0`, so absent key and explicit `0` are byte-identical in the summary
(`reclaim_gb=0.0 unmeasured_builds=1` both). Key on presence-and-validity instead.

**Note — `has_build` has NO producer in the discovery snippet.** `select()` gates candidacy on
`w.get("has_build")` (`worktree-gc.py:146`) and the payload comment at `reference.md:306` lists it, but
the pipeline emits only 3 fields ⇒ a caller building the payload straight from that output gets
`has_build` falsy and **ZERO candidates**. `bld` already knows via `[ -d "$wt/build" ]`.

**Note — an all-unmeasured payload publishes a confident useless plan:** 4 × 30 G, no `build_size_gb`
⇒ `reclaim_count:4, reclaim_gb:0.0, projected_free_gb:2.0, unmeasured_builds:4`. Correct by the stated
rules; `unmeasured_builds == reclaim_count` means the accounting isn't running at all and deserves
louder than a counter.

## Write path

REST issue-comment worked (`gh api repos/.../issues/1114/comments --method POST -F body=@file`).
⚠️ `--field body@/path` is **not** file-loading syntax — it errors `invalid key: "body@/path"`; use
`-F body=@/path`. A `gh pr` wrapper attempt was denied by the PreToolUse hook (consistent with
[[project_nanoclaw_1067_footer_normalizer]]: both `gh pr` wrappers denied on this repo, REST works).

## Related

Supervisor GC lineage: [[feedback_always_reap_merged_worktrees]] (operator standing grant; the
build-output-clear lever this PR does the accounting for) ·
[[feedback_gc_resolve_slice_worktree_head_not_issue]] (the classifier's false-REAP class — untouched
by this PR, which only changes the accounting, confirmed by the 19 classifier tests passing unchanged).
KB/instrument review series: [[project_nanoclaw_1080_kb_health_route]] ·
[[project_nanoclaw_1078_regression_quality]] · [[project_nanoclaw_1076_kb_doctor]].
