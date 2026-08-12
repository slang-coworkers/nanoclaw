---
title: "[approver/challenger-miss] Whole-TEST_CASE skip can drop deterministic coverage bundled with the flaky assertions"
type: learning
topic: review-approval
source: learnings/1785165216238-approver-challenger-miss-whole-test-case-skip-can-.md
---

# [approver/challenger-miss] Whole-TEST_CASE skip can drop deterministic coverage bundled with the flaky assertions

**Context:** slangpy#1076 "Temporarily disable intermittent profiler tests" — a maintainer added `* doctest::skip()` to two `TEST_CASE`s in `tests/sgl/device/test_profiler.cpp` pending the #1072/#1073 drain-ordering fix. Clauses all passed, CI 15/15 green, fallback-tier review (CodeRabbit 0 actionable + Devin 0 flags) = APPROVE. First-pass challenger called it clean → WOULD_APPROVE. DECISION_REVIEW critique caught the miss; final decision = ABSTAIN_POLICY / OPEN_GAP.

**Symptom:** A "disable the flaky test" PR looks trivially safe (narrow diff, green CI, clean bots), so the challenger rounds toward approve. But `doctest::skip()` (and any per-test-case skip mechanism) is **all-or-nothing at the TEST_CASE granularity** — it silences *every* assertion in the case, not just the flaky ones.

**Root cause:** The skipped CPU test bundled two kinds of assertions under one `TEST_CASE`: (a) DETERMINISTIC concurrency-specific frame-rejection checks (cross-thread `begin_frame` rejected while a frame is active, line 358; and rejection right after `end_frame` while a worker zone still drains, line 360) and (b) the INTERMITTENT drain-ordering snapshot/counting checks (lines 369–374) that actually flake. Disabling the whole case to suppress (b) also drops (a) — coverage loss *broader than the PR's stated purpose*.

**How to catch it (transferable to any test-disable PR):**
1. When a PR skips/deletes a whole test, read the FULL test body, not just the diff. List every distinct invariant it asserts.
2. Separate deterministic assertions from the flaky one(s). Only the flaky assertions justify the skip; the deterministic ones are collateral.
3. For each deterministic assertion being lost, grep the whole repo (BOTH the C++/native suite AND the Python suite — coverage often lives cross-language) for an equivalent still-active test. Grep every call site of the API under test (e.g. `begin_frame`) and classify each as the covered behavior vs. not.
4. If a deterministic, uniquely-covered invariant is dropped → **OPEN_GAP → ABSTAIN_POLICY** (not WOULD_APPROVE). It clears only if genuinely covered elsewhere or unreachable.

**Fix / what a human should weigh:** Prefer splitting the flaky assertions into their own `TEST_CASE` and skipping only that, so the deterministic coverage stays live. Absent that, a human must accept the temporary loss explicitly.

**Calibration note:** Don't over-correct — the SAME investigation must check whether the "lost" coverage exists elsewhere. Here the *same-thread* nested-frame rejection was covered by Python `test_nested_frames_are_rejected` (test_profiler.py:327), so the gap narrowed to only the cross-thread + closing-state paths. Overclaiming "sole coverage" without grepping the sibling-language suite is itself a miss (OUTPUT_REVIEW caught this). The OPEN_GAP survived narrowing, but the precision matters for the human reading it.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785165216238-approver-challenger-miss-whole-test-case-skip-can-.md`_
