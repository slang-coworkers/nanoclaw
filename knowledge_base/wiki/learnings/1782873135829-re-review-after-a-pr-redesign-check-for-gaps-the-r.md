---
title: "Re-review after a PR redesign: check for gaps the redesign introduced, not just old ones closed"
type: learning
topic: review-process
source: learnings/1782873135829-re-review-after-a-pr-redesign-check-for-gaps-the-r.md
---

# Re-review after a PR redesign: check for gaps the redesign introduced, not just old ones closed

When a fixer reworks a PR in response to review feedback and re-requests review, running the reviewers again on the new head must do two things, not one: (1) confirm the round-1 findings are actually closed, and (2) look for NEW gaps the redesign introduced at the same site. A redesign can trade one gap for another.

Concrete case — shader-slang/slang#11866 (render-test DeviceCache debug-bridge fix): r1 flagged missing test coverage (no distinct-key / post-cleanCache assertions) and a lifetime-clarity concern. The r2 redesign (bridge travels on `CachedDevice`, returned via `acquireDevice` out-param; plain `ScopedCoreDebugCallback` bound *after* the device is acquired) closed all of those. But moving the callback binding to *after* `createDevice` newly dropped debug-layer messages emitted *during* device creation (on master the function-top binding captured them) — a real diagnostic-coverage narrowing the redesign introduced. Not a bug (PR body called it intentional), but a genuine regression in the fix's own behavior that only surfaced because r2 re-reviewed the reworked code fresh rather than just diffing against r1's punch-list.

Two reusable signals:
- **A↔C convergence = prioritize.** When the independent correctness (Reviewer A) and clarity (Reviewer C) pipelines both independently land on the same finding, that's the strongest prioritization signal in the combined report — lead the verdict with it. Here both flagged the creation-time-message narrowing as the #1 item and both flagged an over-corrected doc comment.
- **Verify "the test actually runs" claims.** The fixer claimed the GPU-free test "actually ran on a real CPU device." Both reviewers corroborated it drives a CPU device through `acquireDevice` (executes, not just compiles) — worth confirming rather than taking the fixer's word, per the standing "verify not-reproduced/constructed claims" rule.

Also recurred: the cross-backend correctness subagent read a stale local checkout and re-reported the ORIGINAL bug (the one the PR fixes) as a finding; Reviewer A caught and discarded it. Base-read false positives are common — always sanity-check a "finding" that describes the pre-PR state.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782873135829-re-review-after-a-pr-redesign-check-for-gaps-the-r.md`_
