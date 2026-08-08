---
name: project_review_pipeline_substitutes_skipped_for_missing_artifact
description: "The slang PR-review merge step writes `_skipped_` when a reviewer's final-review.md is absent, so a DEAD reviewer's silence enters the combined report looking like a clean result. Measured on #12359: 3 reviewers dispatched, 0 artifacts, 2 died silently."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2a773ee3-227d-40db-873e-8ed53e15f807
---

Measured 2026-08-06 during review of shader-slang/slang PR #12359 (issue #12355), reported by
`slang-reviewer` after all three dispatched reviewers failed.

## The defect

The combined-report merge step substitutes **`_skipped_`** for a reviewer whose
`final-review.md` is missing. Absence therefore enters the report in the same shape as
"reviewed, nothing found." A reader of the combined report cannot distinguish them.

`final-review.md` / `tool-uses.jsonl` / `subagents/` are written by `repro.sh` only **after**
the inner CLI exits (lines 136/152/167), so **any** interrupted run leaves none of them. This is
structural, not incidental: a reviewer that dies for any reason produces exactly the artifact set
that reads as a clean skip.

## The measured instance — three reviewers, zero artifacts, two silent

| reviewer | failure | announced itself? |
|---|---|---|
| A (correctness) | **$30 budget cap** (`error_max_budget_usd`, $30.06) killed its subagents *before* the extraction step | ❌ no — and its REVIEW-GUARD reported "zero Task dispatches", a **false negative**; subagents demonstrably ran |
| B (Devin) | 30-min timeout, exit 3 | ✅ yes — stated reason, correctly marked skipped |
| C (clarity) | died in session teardown | ❌ no |

⇒ A combined verdict, had one been assembled, would have been **built from three absences**
with two of them indistinguishable from clean passes. It was moot only because two human
approvals landed on the head first.

## Two things to fix, not just remember

1. **A dead reviewer must be structurally unable to contribute silence to a merge.** The
   discipline is `[ -s final-review.md ]` — a non-empty-artifact check, **not** "the process
   exited". But a discipline that must be remembered by the next runner is not a fix; the merge
   step should refuse to substitute a placeholder for a missing file.
2. **The $30 budget cap fails destructively.** $30 was insufficient for one PR at Opus, and
   exhaustion kills subagents at an arbitrary point *before* extraction — so completed reviewer
   work sits **recoverable-but-unwritten** in `stream.jsonl` (A reached 3.3 MB / 455+ tool
   calls). Either raise the cap or run extraction on the budget-exhausted path.

## Why this is the worst member of the instrument-defect family

A's REVIEW-GUARD is the **unexecuted-guard** mechanism: a check reporting clean because it never
ran, not because the condition held. The other four mechanisms corrupt a *measurement*; this one
corrupts the layer meant to **catch** a corrupted measurement. Its discriminator is different —
not *what can my pattern miss?* but ***did my check execute at all, and would it fire on a
known-positive?*** A guard whose negative result is byte-identical whether it ran or not is
decoration.

Benign here only by luck: A died before writing an artifact, so nothing downstream consumed the
false all-clear. Had it survived to extraction, "zero dispatches" would have read as a clean audit.

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]] ·
[[feedback_ci_checks_at_a_sha_expire_source_at_a_sha_does_not]] ·
[[feedback_zero_test_jobs_is_not_zero_tests_ran]]
