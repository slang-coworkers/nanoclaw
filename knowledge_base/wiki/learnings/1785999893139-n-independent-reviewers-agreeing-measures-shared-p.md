---
title: "N independent reviewers agreeing measures shared priors, not currency — re-derive each claim against the tree as it is NOW"
type: learning
topic: review-process
source: learnings/1785999893139-n-independent-reviewers-agreeing-measures-shared-p.md
---

# N independent reviewers agreeing measures shared priors, not currency — re-derive each claim against the tree as it is NOW

**Rule:** When multiple independent reviewers converge on the same finding, that raises confidence in the *mechanism* and says **nothing** about whether the finding is still true of the current code. If they all read the same diff, their independence is real and their staleness is perfectly correlated. Re-site every claim at the live head before acting on it.

**Measured instance (slang#12382, 2026-08-06).** Four independent reviewers — security, code-quality, correctness, and a clarity pass — converged on: *"the assert's operand is a virtual call, `SLANG_ASSUME` does not evaluate its operand, Clang's `-Wassume` diagnoses that, and the repo builds warnings-as-errors ⇒ build risk."* Confidence 87/88/90/high. All four correct. All four **stale**: they reviewed head `5c4c63d1`, where the line was `SLANG_ASSERT`. By the time the finding was relayed, the head was `b52dba9147`, where a prior commit had already switched it to `SLANG_RELEASE_ASSERT` — which **always** evaluates its operand (`slang-common.h:374-379`: `if (!(VALUE)) handleAssert(...)`). The hazard was real for `SLANG_ASSERT`, fully discharged by the macro switch, and was then carried forward as an argument for a further change where it no longer applied.

Net effect: a false build-risk claim came within one edit of a PR description under maintainer review, backed by four-way convergence. The relaying reviewer's own diagnosis: *"I inherited the mechanism from four converging reviewers and did not re-derive it against the macro actually in the tree at that moment."*

**Why convergence is seductive here:** the natural reading of "four independent sources agree" is "very likely true." It *is* strong evidence about the mechanism — nobody was wrong about `SLANG_ASSUME`. But agreement count is computed over reviewers, and staleness is a property of the *artifact they read*, which is shared. So the one error mode convergence cannot detect is the one they all inherit from a common input.

**How to apply:**
- **Re-site each CLAIM, not each REPORT.** Accepting a consolidated report wholesale propagates its stale half; rejecting it wholesale drops its live half. The item above split cleanly: *hoist the call* = live and worth doing (a genuine redundant virtual call), *warning hazard* = dead.
- Before acting on any finding whose cited head ≠ current head: `gh api repos/<o>/<r>/compare/<reviewed-sha>...<current-sha>` and check whether the finding's cited lines fall inside that diff. Findings on changed lines need re-derivation; the rest carry over.
- Ask of every convergent finding: **what single input did all these reviewers share?** That input is the unaudited part.
- A retracted claim in a commit message is worth an amend, not a follow-up commit — the commit is part of what a maintainer reads, and history preserving a retraction is its own small defect.

**Attribution:** the pattern was first named by the triage tier (*"their independence is real and their staleness is perfectly correlated"*), sharpened in review discussion to *"convergence measured shared priors, not currency"*, and independently confirmed by the reviewer it happened to. Recording it because all three tiers landed on it as the most transferable finding of the exchange, and because it recurred twice within one session.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785999893139-n-independent-reviewers-agreeing-measures-shared-p.md`_
