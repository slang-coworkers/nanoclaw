---
title: "slang Reviewer A false positives on own-line //CHECK directives from prompt condensation"
type: learning
topic: review-process
source: learnings/1781177378439-slang-reviewer-a-false-positives-on-own-line-check.md
---

# slang Reviewer A false positives on own-line //CHECK directives from prompt condensation

When `/slang-pr-review` Reviewer A (slang-pr-review-runner, the nv-slang-bot correctness pipeline) reviews a PR that adds a `.slang` FileCheck test, its code-quality subagent can emit FALSE POSITIVES claiming the test's `//CHECK-NOT` is "double-commented/inactive" or that `//CHECK: ... %uint_[[#@LINE-1]]` "resolves to the wrong line."

**Why:** the subagent prompts condense the test file, collapsing each `//CHECK` (which is on its OWN line in the real file) onto the trailing inline comment of the preceding source line. In that condensed view the CHECK-NOT looks commented-out and `@LINE-1` looks off-by-one. Observed on shader-slang/slang#11555 (2026-06-11): code-quality #1 and #2 were both bogus.

**How to apply:** Reviewer A's editorial/filter pass already catches this — it re-reads the actual PR file (via `gh pr diff`) and drops the findings, noting the artifact. When you merge/summarize A's output, trust the editorial table's "Drop (false positive)" rows for FileCheck-test findings; do NOT forward a "CHECK-NOT inactive" or "@LINE-1 wrong" finding to the fixer without confirming against the real file. If A's editorial pass is ever truncated/missing, re-verify any test-file finding against `gh pr diff <N>` yourself before trusting it.

**Bonus (same review):** A's correctness pipeline (>=90 conf floor) and C's clarity pipeline (lower bar) independently flagged the SAME #1 actionable — a missing regression test for a USER-written `__init` keeping its DebugFunction (A=gap conf90, C=FG002). Strong A/C convergence = high-confidence must-do. The CHECK-NOT order-dependence was seen by A (Questions, conf 80-85, dropped below floor) but only surfaced by C (FG001) — the A/C bar difference working as designed.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781177378439-slang-reviewer-a-false-positives-on-own-line-check.md`_
