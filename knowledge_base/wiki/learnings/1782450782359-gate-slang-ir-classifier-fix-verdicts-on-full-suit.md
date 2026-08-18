---
title: "Gate Slang IR/classifier fix verdicts on full-suite CI"
type: learning
topic: slang-compiler
source: learnings/1782450782359-gate-slang-ir-classifier-fix-verdicts-on-full-suit.md
---

# Gate Slang IR/classifier fix verdicts on full-suite CI

**Rule:** For Slang IR-level / classifier / lowering changes, do NOT declare a fix verified (fixer) or APPROVE a PR (reviewer) on the basis of a static peer review or a narrow local test sweep (a single directory such as `tests/diagnostics/`). Gate both the fixer's "green" claim and the reviewer's verdict on a **full-suite CI** run.

**Why:** On shader-slang/slang#11763 / draft PR #11764 (2026-06-26), a lever-1 classifier broadening (classify a store's value operand as a *read* so the uninitialized-use check / E41016 fires for direct copies `x = uninit;`) passed the fixer's `tests/diagnostics/` sweep (601/601) AND earned a peer APPROVE — yet full-suite CI (run 28214047079) caught a **real false positive** on all 5 platforms: `self.self = &self;` lowers to `store(getFieldAddr(self), self)` where operand-1 is a POINTER (an address). Storing an address ≠ reading the location's contents, so the over-broad classifier spuriously emitted E41016. The single failing test lived in `tests/bugs/` (`llvm-debug-data-recursion.slang`) — a directory the narrow sweep never covered. The reviewer's round-2 APPROVE was premature for the same reason (it never ran the full suite locally). Round-3 narrowed the arm to `inst == getOperand(1) && !as<IRPtrTypeBase>(inst->getDataType())`, reusing the function's existing pointer-vs-value rule, plus a negative-control test case. The reviewer separately flagged that a classifier change can silently alter an **untested second consumer** (here: constructor field-init analysis).

**How to apply:**
- *Fixer:* before claiming a fix is verified/green, run the broad suite — at minimum `tests/bugs/` + `tests/diagnostics/`, ideally full-suite CI. A classifier/IR-level change can regress unrelated directories that a bug-class-matched directory sweep misses.
- *Reviewer:* hold APPROVE/verdict until full-suite CI is green, not static review alone. For any classifier/analysis-predicate change, explicitly check whether the predicate has other (untested) consumers.
- The **drafts-only guardrail is what makes this safe** — the FP was caught before merge precisely because the PR was never flipped to ready. This is the value of holding fixer PRs as drafts pending CI.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782450782359-gate-slang-ir-classifier-fix-verdicts-on-full-suit.md`_
