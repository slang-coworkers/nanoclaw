---
name: project_12351_agentic_tests_streak_bounded_regression
description: "slang#12351 (bot-filed 08-04, CLOSED completed 08-21 by jvepsalainen-nv): 'Nightly agentic-tests has never passed'. Main-measured: FALSE — 16 passes under retired workflow id 287019999 (rename #11828 minted 304423282); streak was an exact bounded 36 (last pass 06-29, window 3a84a12b8e..80bf926b57); suppression list 24 entries not 195. Fixed by #12531 regen + #12571/#12573/#12539; first green nightly 08-19. TERMINAL; residual reds are the #12534 transport flake — do not reopen for those."
metadata: 
  node_type: memory
  type: project
  title: "slang#12351 — agentic-tests streak is bounded, not beginningless"
  tags: 
    - slang
    - ci
    - agentic-tests
    - nightly
    - correction
  originSessionId: ac138413-f175-4e9e-a8ba-3d61754cbb89
---

# slang#12351 — the streak had a START, and the suite had passed

## State: ✅ CLOSED `completed` 2026-08-21 by `jvepsalainen-nv` ("Fixed. Closing."). TERMINAL.

- Drift fixed by [PR #12531](https://github.com/shader-slang/slang/pull/12531) (merged 08-14; it
  regenerated the bundles against the current language). Remaining causes were fixed or mitigated by
  **#12571** (#12442 HLSL prelude leak), **#12573** (retries on a fresh server; *mitigates* the #12534
  test-server transport flake) and **#12539** (our bot's unorm/snorm `ModifiedType` SIGSEGV fix for
  #12535). All three merged 08-17/08-19.
- **First green nightly since 2026-06-29 landed 08-19.** 08-21 was red again with **1 failing**
  (`module-roundtrip-preserves-public-symbol.slang.1`, 12 transport-fault signatures). That is the
  known #12534 residual, not a new cause.
- ⛔ **Don't reopen for a red caused by a transport flake.** Resume only on a **non-transport,
  repeating** failure or a real `@nv-slang-bot` mention. Every `pr_mention` on this chain was a
  false positive (0 mentions in the body), so the bot never posted unprompted.
- Owner of the suite: `jvepsalainen-nv`, verified by measurement (14/17 commits under
  `docs/generated/tests`, 7/7 touching `_meta/expected-failures.txt`). Our public comment
  `5186113055` is owned by `slang-ci-babysitter`. The maintainer's tests also surfaced real
  compiler bugs #12440–#12443, which vindicates the issue's thesis that an always-red signal can't
  report wins like that.

## What the original issue got wrong (Main-measured 08-04)

1. **"Never passed in retained history": FALSE.** 16 successes sit under retired workflow id
   **287019999** (`state: deleted`, absent from the `actions/workflows` listing). Rename `cf5d225f8c`
   (#11828, 2026-06-30) minted id **304423282**. Mechanism:
   [[technique_workflow_rename_mints_new_id_old_id_deleted]].
2. **The "≥36" floor was really an exact, bounded 36**, found via `previous_filename`: last pass
   run `28350804872` 06-29 @ `3a84a12b8e`, first fail `28422435803` 06-30 @ `80bf926b57`, a window of
   15 commits. The rename itself was measured as non-causal (it changed only the name and a comment).
3. **"expected-failures.txt (195 lines)"** is 155 comments + 16 blank + **24 entries**.
4. **Before the rename it wasn't healthy either:** 16 pass / 17 fail, flapping, worst prior streak
   8 nights. The honest framing is that it always flapped, and after 06-29 it stopped flapping into
   green.
5. The 07-09 reconciliation **#12017** (`+24/−0`, which *created* the 24-entry list) did **not**
   restore green: 25 fail / 1 cancelled / 0 success after it.

The issue was right about the scope (an advisory suite running `-test-dir docs/generated/tests`, not
`tests/`, so no compiler regression), about the gate being bidirectional (stale-passes also fail
it), and about the no-hand-edit routing via `_meta/regenerate.md`.

## Durable lessons from this chain

- ⭐⭐ **A date-only boundary silently pulls in pre-event rows when the event has a TIME.** I counted
  26 post-#12017 runs instead of 25 because the 05:22Z run predated the 09:03Z merge. Compare full
  timestamps.
- ⭐⭐ **A published prediction obliges you to check back.** "Tonight's run will make it 37" goes stale
  on a known schedule, and checking it costs one call. (It resolved: run `30977023222` failed.)
- ⭐⭐⭐ **A characterization inferred from 2–3 samples ("stable", "consistent") is the first thing to
  re-test when sample N+1 lands.** The count is visible; the characterization isn't. The "small,
  stable drift set" changed overnight (10→11 failing, 5→4 stale-pass).
- ⭐⭐ **A bump is not a find-and-replace.** Going 36→37 left three derived figures stale (the ratio,
  the post-#12017 tally, the characterization). List everything derived from a number before editing
  it.
- ⛔ **An unescaped `.` in a literal-string grep inflates the count.** `grep -oi 4.5` matched
  `4.6`/`4552`. Use `grep -F` and sanity-check counts against `grep -n`.
- In-place edit over a new comment when a bot-authored issue's body is the only wrong public artifact
  (the precedent was #12341). An in-place edit notifies nobody, though
  ([[feedback_an_in_place_edit_notifies_nobody]]).
- Boundary logs had returned **410 Gone**, so annotations were the only surviving record, and they
  carry no diagnostics ([[technique_annotations_survive_log_expiry_step_relative_line]]).

Related: [[project_12326_throw_statement_missing_semicolon]] (the same nightly-only blindness from the
merge side), [[project_11988_nightly_spvopt_workflow_parked]],
[[feedback_green_job_skipped_backend_zero_coverage]].
