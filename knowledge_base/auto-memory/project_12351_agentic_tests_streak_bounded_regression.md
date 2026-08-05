---
name: project_12351_agentic_tests_streak_bounded_regression
description: "slang#12351 (bot-filed, OPEN, unlabeled, 0 comments): 'Nightly agentic-tests has never passed in retained history (>=36 nights)'. Main-measured 2026-08-04: the never-passed claim is FALSE and the >=36 FLOOR INVERTS to an exact bounded 36 — 16 passes exist under retired workflow id 287019999 (rename #11828 minted new id 304423282), last pass 2026-06-29, first fail 2026-06-30, window = 15 commits 3a84a12b8e..80bf926b57. Rename measured non-causal (name + comment only). Suppression list is 24 entries, not 195. Correction dispatched to slang-ci-babysitter on gh-issue-shader-slang/slang-12351."
metadata: 
  node_type: memory
  type: project
  title: "slang#12351 — agentic-tests streak is bounded, not beginningless"
  tags: 
    - slang
    - ci
    - agentic-tests
    - nightly
    - live-chain
    - correction
  originSessionId: ac138413-f175-4e9e-a8ba-3d61754cbb89
---

# slang#12351 — the streak has a START, and the suite has passed

**Filed by `nv-slang-bot[bot]` 2026-08-04. State at handoff: OPEN, no labels, no assignees,
0 comments.** Almost certainly authored by `slang-ci-babysitter` (cross-refs #12341/#12342, its
same-day chains).

The report's core measurement reproduces exactly; its **conclusion does not survive**. I checked
before routing because a peer's count carries no provenance.

## What is right in the issue

- ✅ Scope caveat is correct and valuable: one job, `agentic-tests`, running
  `slang-test -test-dir docs/generated/tests` — the LLM-generated bundles, **not** `tests/`.
  No compiler regression implied. Keep this framing.
- ✅ Not host-scoped: sampled runner ids all distinct.
- ✅ The advisory-signal argument ("an always-red advisory signal carries no information") is the
  right reason to file.
- ✅ Bidirectional gate is real: 10 failing **plus 5 listed-expected-fail that now PASS**, so
  appending to the suppression list cannot clear it.
- ✅ The no-hand-edit routing (regenerate / fix source doc / manifest → `mark-fresh`) matches
  `_meta/regenerate.md` and the shared learning
  `1782217764152-agentic-test-bundle-staleness-is-often-compiler-dr.md`.

## What is wrong

**1. "Never completed successfully in retained run history" — FALSE.**
16 successes exist. They sit under retired workflow id **287019999**
(`ci-agentic-tests-nightly.yml`, name "Agentic Tests (Nightly)", `state: deleted`, **absent from the
`actions/workflows` listing**). Rename `cf5d225f8c` (#11828, 2026-06-30T02:37:22Z) minted the new id
**304423282**. Full mechanism + recipe:
[[technique_workflow_rename_mints_new_id_old_id_deleted]].

**2. The `≥36` floor inverts.** The issue hedged that the streak might be *older* than 36 because the
API "cannot distinguish 'workflow created then' from 'older history purged'." It can — via
`previous_filename`. The streak is **exactly 36 with a known boundary**, which is strictly more
actionable than the floor:

```
last PASS : run 28350804872  2026-06-29T05:31:48Z  head 3a84a12b8e   (old id 287019999)
first FAIL: run 28422435803  2026-06-30T05:26:38Z  head 80bf926b57   (new id 304423282)
window    : 15 commits, 98 files  (compare 3a84a12b8e...80bf926b57)
```

**3. The rename is NOT the cause** (checked, since it is the obvious suspect). Its entire patch to the
workflow is `name: Agentic Tests (Nightly)` → `name: Nightly Slang Test` plus one comment line
referencing the renamed coverage workflow; the only other relevant edit is comment prose in
`_meta/agentic-coverage-excludes.txt`. No `uses:`, no `-test-dir`, no path change.

**4. "expected-failures.txt (currently 195 lines)" overstates ~8×.** 195 total = **155 comments +
16 blank + 24 entries**. The bidirectional-gate conclusion still holds; only the figure is wrong.

**5. Pre-rename was not healthy either** — do not overcorrect into "green before the rename".
Predecessor was **16 pass / 17 fail**, flapping, worst prior fail streak 8 nights (06-16→06-23).
Honest framing: **the suite always flapped; after 2026-06-29 it stopped flapping into green at all.**
36 consecutive is ~4.5× the worst prior streak — a real change in a noisy signal.

## Candidates in the window (NOT diagnosed — do not publish as cause)

Boundary logs are **410 Gone** both sides, so the drift set cannot be attributed from logs. Of the 15
commits, the diagnostic/IR-touching ones fit the two known staleness classes in the shared learning:
`c21ead2690` improve character/string literals (#11714) · `51959e21ff` warn on copy of uninitialized
value (#11764) · `6b473bdfbe` validate generic struct capability reqs (#11770) · `e248123ba9`
`[require]` caps on inverse-placed derivatives (#11558) · `80bf926b57` qualify extension-method name
hints (#11581) — that last one is exactly the **IR-LABEL mangled-name drift** class, and
`c8897a19fd` (GLSL array-constructor syntax) could move target-pipeline CHECKs. Annotations survive
the 410 but carry only `Process completed with exit code 1` — per
[[technique_annotations_survive_log_expiry_step_relative_line]] that surface never carried
diagnostics. **A local `slang-test -test-dir docs/generated/tests` run at the boundary shas is the
only way to attribute; today's run log is alive and is the cheaper start.**

## Also note

The 07-09 reconciliation (`08af86542f`, #12017, "update round … against the regenerated design docs")
**did not restore green** — ⛔**25 failure / 1 cancelled / 0 success** (babysitter-caught; **my 26 was
off by one — I filtered `created_at>"2026-07-09"` when the merge was `09:03:26Z`, so I counted that
night's `05:22:16Z` run, which ran BEFORE the fix landed**) ⇒ ⭐⭐**a date-only boundary silently
includes pre-event rows when the event has a TIME — compare against the full timestamp, and a
same-day run is on the wrong side of a mid-day merge.** ✅**Stronger than a bare touch: #12017 was
`+24/−0` to that file ⇒ it CREATED the entire current 24-entry suppression set**, and still 0 success
after it. So this is not a
never-attempted chore; a prior reconciliation already failed to hold. Worth saying so, or a maintainer
will reasonably ask why the same fix should work now.

Related: [[project_12326_throw_statement_missing_semicolon]] measured the same blindness from the
other side (a merge landing green because this dir is nightly-only), and found the "Lint on PR" check
that `regenerate.md` names as the intended attachment point **does not exist**. Also
[[project_11988_nightly_spvopt_workflow_parked]] (different nightly, same file family).
[[feedback_green_job_skipped_backend_zero_coverage]] is the shape.

## State

Correction dispatched to **`slang-ci-babysitter`** (closest-to-the-state: it holds the issue and owns
the GitHub comment) on canonical thread `gh-issue-shader-slang/slang-12351`. Asked for an **in-place
body edit**, not a new comment — the issue is bot-authored with 0 comments, so the wrong numbers are
still the only public artifact, and #12341's republished-refuted-claim episode is the precedent for
fixing the artifact rather than appending a retraction.

⚠️ **I did NOT dispatch a fixer.** Remedy is operator/maintainer-gated by the no-hand-edit policy;
route (2) "fix the source doc" is a separate PR per `regenerate.md`.

**RESUME** = babysitter reports the edit landed (then verify the live body carries 24-not-195 and the
bounded-streak framing, with a single distinctive token, not a multi-word phrase), **or** a human
comments on #12351, **or** a reconciliation PR appears touching
`docs/generated/tests/_meta/expected-failures.txt` → route to slang-reviewer.
