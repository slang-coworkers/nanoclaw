---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787894915220-alf2w3
written_at: 2026-08-28T06:15:57.149Z
---

# [approver/human-agreement] Trivial correct-idiom compiler-macro fix (add `inline` to always_inline) — WOULD_APPROVE merged unchanged, human APPROVED

## Outcome
slangpy#1125 "Fix SGL_INLINE on GCC and Clang" — my **WOULD_APPROVE @
cd6265395c76** matched the human outcome: skallweitNV **APPROVED**, merged by
tdavidovicNV **at the exact commit I decided on** (no follow-up commits between
decision and merged head). Confirmation, not a miss — recording the *class* so
Step-0 recall sharpens for similar changes.

## The class of change that was safe
A **one-line preprocessor-macro fix that applies a documented correct idiom**,
with a fully-enumerable and small consumer set:
- diff: non-MSVC `SGL_INLINE` `__attribute__((always_inline))` →
  `inline __attribute__((always_inline))` (macros.h).
- ALL consumers enumerated: `grep SGL_INLINE` over the tree at the pinned commit
  → exactly 2, both **in-class member functions** (`SHA1` in crypto.h), which
  are already implicitly `inline` ⇒ the added keyword is redundant-harmless there
  ⇒ provably zero behavior change for existing callers.
- the guarded branch (`SGL_CLANG|SGL_GCC`) is the **active compiler-selection
  path**, exercised in both directions by CI (completed clang+gcc build jobs
  green on head) — not a dead/unset flag.

## Transferable signal (what to probe, cheaply, next time)
For a macro/attribute/definition change, the decisive checks are cheap and
should be done directly, not deferred to reviewers:
1. **Enumerate every consumer** of the changed symbol at the pinned commit and
   classify each (here: all in-class → implicitly inline). A small, uniform
   consumer set with a benign classification is strong positive evidence.
2. **Confirm the change is a known-correct idiom**, not a novel construct — on
   GCC `always_inline` requires `inline` (hard `-Werror=attributes` failure at
   namespace scope); on Clang it is accepted without, so the keyword is a
   harmless consistency spelling. Getting the compiler-specificity right matters
   for the audit trail (a DECISION_REVIEW advisory corrected my initial
   "GCC/Clang both require" phrasing).
3. **Verify both-directions CI** on the guarded branch (green clang AND gcc jobs)
   — turns "no red flags" into a positive control.
When all three hold on a ≤ few-line macro fix, WOULD_APPROVE is well-calibrated.

## Harvest note (see sibling learning)
Primary signal here was CodeRabbit's clean verdict posted as an **issue
comment** (harvest exit 20 — no formal review object); reading issue comments
recovered it. Do not treat exit 20 + CodeRabbit-status-success as
NO_REVIEW_SIGNAL.
