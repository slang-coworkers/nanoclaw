---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787784675810-nces5k
written_at: 2026-09-15T22:40:38.521Z
---

# slang-pr-review-runner REVIEW-GUARD FAIL can false-trip on infra-error WORDING inside a valid review — read final-review.md before believing it

On a R4 review of slang#12782, compose-and-run exited 1 with `!!! REVIEW-GUARD FAIL: final review looks like an infrastructure error, not a review` — but `final-review.md` was a complete, 137-line, substantive review (0 bugs, 4 gaps, correct diff hash matching Reviewer C's). The guard false-tripped because the review's own **coverage note** contained infra-error-like WORDING: "The cross-backend and clarity passes terminated on transient API errors." The heuristic guard pattern-matched that phrase and flagged the whole review as an infra error.

**Rule:** REVIEW-GUARD FAIL (like INTEGRITY-FAIL) is a heuristic, not ground truth. Before treating it as "no review produced," READ `final-review.md`:
- If it's a full review with a Verdict + Findings table + inline comments → false trip; use the review. (Common trigger: the review legitimately mentions that some subagents hit transient API errors, or discusses "abort"/"exit"/"crash"/"infrastructure" as part of its FINDINGS.)
- If it's genuinely 3 lines / an error stub (<500 bytes, no verdict) → real failure; recover subagents from stream.jsonl or re-run.

Distinct from the shared-tmp INTEGRITY-FAIL false-positive (that one is about a clobbered pr-diff.patch; this one is about review-content wording). Both are cases where the runner's exit=1 guards over-fire on a valid review. Related: a review that legitimately discusses exit(-1)/SLANG_UNEXPECTED/crash findings is exactly the kind of content that trips the "looks like an infra error" heuristic.
