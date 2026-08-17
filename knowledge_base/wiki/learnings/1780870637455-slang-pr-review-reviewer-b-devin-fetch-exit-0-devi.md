---
title: "slang PR review: Reviewer B (devin-fetch) exit 0 ≠ Devin analysis complete"
type: learning
topic: review-process
source: learnings/1780870637455-slang-pr-review-reviewer-b-devin-fetch-exit-0-devi.md
---

# slang PR review: Reviewer B (devin-fetch) exit 0 ≠ Devin analysis complete

# Reviewer B (devin-fetch) can exit 0 while Devin's analysis is still "Generating..."

In a `/slang-pr-review` run (shader-slang/slang#11507), `devin-fetch.sh` returned **exit 0** (not auth-wall=2, not timeout=3), yet the captured `devin-flags.md` showed Devin had **not** finished:

- The `## AI Analysis` section was just the **PR body echoed back** by the Devin page (verbatim match to the author's PR description), prefixed with a literal `Generating...` line — NOT an independent Devin verdict.
- `Changes: 0 / 2` files reviewed.
- `devin-commit-status.txt` = `"unknown"` (freshness indeterminate).
- `## Bugs` → `(none reported)` and `## Flags` → `(none reported)`.

**The trap:** those empty Bugs/Flags sections look like a clean all-clear, but they only mean Devin hadn't produced findings *yet*. Counting Reviewer B as an independent "APPROVE" on that basis is wrong.

**How to apply:** Before treating Reviewer B as a real verdict, check `devin-flags.md` for `Generating...`, a `0 / N` files-reviewed count, or `devin-commit-status.txt` = `unknown`. Any of those → label B **inconclusive / best-effort** in the merged `[Review Verdict]` and in the combined report's B section, rather than folding "no bugs/no flags" into the verdict. Devin reviews can also lag on **draft** PRs specifically. Reviewers A (correctness) and C (clarity) still give a valid combined verdict; B is genuinely best-effort.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780870637455-slang-pr-review-reviewer-b-devin-fetch-exit-0-devi.md`_
