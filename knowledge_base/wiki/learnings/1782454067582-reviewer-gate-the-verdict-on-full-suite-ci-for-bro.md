---
title: "Reviewer: gate the verdict on full-suite CI for broad-blast-radius changes, not static review alone"
type: learning
topic: review-process
source: learnings/1782454067582-reviewer-gate-the-verdict-on-full-suite-ci-for-bro.md
---

# Reviewer: gate the verdict on full-suite CI for broad-blast-radius changes, not static review alone

Concrete incident (shader-slang/slang PR #11764, the uninitialized-value direct-copy fix): I (slang-reviewer) issued APPROVE after three independent static reviewers (A correctness, B Devin, C clarity) all passed a change to a **shared IR classifier** (`getInstructionUsageType` in `slang-ir-use-uninitialized-values.cpp`). The change broadened operand-1 classification to "read" for the store family. CI then caught a real **false positive** none of the static reviewers found: `self.self = &self;` lowers to `store(getFieldAddr(self), self)` where operand 1 is a pointer (address) — storing an address isn't a read, so it spuriously warned. Failing test: `tests/bugs/llvm-debug-data-recursion.slang`.

**Rule:** When reviewing a change to a shared IR classifier / helper consumed by multiple passes (broad blast radius), do **not** issue APPROVE on static review alone. Gate the verdict on a **green full-suite CI run** on the PR head.

**Why:** Static review (even 3 reviewers) reasons about the changed lines; it systematically under-weights *other consumers* of a shared helper and *input shapes the author didn't consider* (here, a pointer-typed store value). The full test suite exercises those paths. CI was the only thing that caught it.

**How to apply:**
- For broad-blast-radius changes, treat full-suite CI-green as **necessary** before APPROVE. But it is **not sufficient** — also probe for *untested* consumers of the changed helper (in #11764 the same classifier also feeds `isDirectlyWrittenTo`→`checkFieldsFromExit` constructor field-init analysis; ask for a focused test on that path).
- On a bot DRAFT PR, the auto `pull_request` CI is draft-gated and won't run — confirm the fixer dispatched `ci.yml` via `workflow_dispatch` (not draft-gated) so a real full-suite run exists to gate on.
- The fix narrowing that resolves such an FP often *also* shrinks the blast radius elsewhere (here the `!as<IRPtrTypeBase>(inst->getDataType())` pointer exclusion that fixed the FP also kept IRVar-origin stores classified as `Store`, neutralizing most of the second-consumer risk). Re-trace the other consumers after the narrowing, don't assume the round-1 concern still stands.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1782454067582-reviewer-gate-the-verdict-on-full-suite-ci-for-bro.md`_
