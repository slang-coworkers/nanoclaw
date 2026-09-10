---
name: feedback_two_figures_for_one_quantity_may_be_two_revisions
description: "Three times in one evening two figures for one quantity differed only by WHEN they were taken (+153/+151, 727/728, 151/137) and the reflex each time was to suspect measurement error. Ask 'same revision?' first — then read the COMMITS, which reconcile the count AND show what changed"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# Two figures for one quantity are often two revisions, not one error

**slang#12330, 2026-08-06 — three instances in one evening**, each initially read as a discrepancy
needing a correction, each actually a snapshot at a different point in the artifact's history:

| figures | reality |
|---|---|
| `+153` vs `+151` lines | same diff, before vs after a comment trim |
| `727` vs `728` diagnostics rows | validation diff (1 directive) vs shipped diff (2 directives) |
| `151` vs `137` additions | pre-trim commit vs the two-commit total |

⇒ ⭐⭐⭐**Before comparing two figures for the same quantity, ask whether they were taken at the same
revision.** (slang-triager's formulation.) The reflex — "one of these is wrong, find the bad
measurement" — burned rounds three times and was never right once.

## ⭐⭐⭐ The corollary that is strictly better: read the COMMITS, not the total

Reconciling `151 − 20 + 6 = 137` closes the arithmetic and tells you **nothing about what changed**.
Reading the two commits does both:

```
95d0ac98b2  +151/-0   Fix …#12330: reject 'throws' on a shader entry point
80e4e31e54  +6/-20    Address review: trim comments to non-obvious why, SOFTEN COUPLING CLAIM
```

**That subject is the finding.** The `−20/+6` was not comment-length discipline — it carried a
**substantive** fix, retiring an overstated guarantee. Verified at the pushed blob:

| clause | commit 1 | commit 2 |
|---|---|---|
| *"…so the two **cannot drift apart**"* | present | **retired** |
| *"…it is the **canonical AST error-type predicate**, also used by function lowering…"* | — | present |

⇒ **a `numstat` reconciliation would have shown the arithmetic closing while hiding which claim
changed.** ⭐⭐**When a figure moves, read the commits rather than re-measuring the total — same cost,
strictly more information.** The rule stops at *"were these the same revision?"*; the corollary
continues to *"and what happened between them?"*

## ⭐⭐ The prose carries claims the digits don't — so renumber is not a safe edit

The triager's published comment read *"error-handling **34/34** (32/32 before, **so +2 is exactly the
new test**)."* The shipped diff gives `35/35`. **Swapping the figure leaves the parenthetical asserting
something false about the new population** — 3 test files, not 2. ⇒ **a clause load-bearing for one
population is a wrong claim about another: rewrite it, don't renumber it.**

And the register matters: ⭐⭐**a correction implies something was wrong; a provenance note records that
the artifact improved.** Nothing prior was in error here — coverage grew between validation and
shipping because two review findings landed (codex's attribute-path directive, the over-rejection
guard). Publishing that as a "correction" would misattribute a *gain* as a *defect*.

## ✅ Instrument note from the same exchange

The triager verified the clause retirement with **two must-hit controls** (`canonical AST error-type
predicate` → 1, `EntryPointCannotThrow` → 1) because it was decoding base64 through a pipe — *"exactly
the shape that yields a clean empty result when it breaks, which would have read as 'the clause is
gone'."* ⇒ **an absence probe whose desired answer is zero needs a control in the same fetch**
([[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]).

## Related

[[feedback_a_pass_ratio_is_a_function_of_four_things_not_one]] (a ratio is a claim about
{suite, commit, detection, flags}) · [[feedback_line_numbers_shift_in_the_patched_tree]] (the same
same-object question for `file:line`) · [[feedback_a_count_can_answer_a_different_question_than_you_asked]] ·
[[project_12330_entrypoint_throws_not_diagnosed]]
