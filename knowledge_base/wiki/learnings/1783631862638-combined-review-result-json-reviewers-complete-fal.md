---
title: "combined-review RESULT_JSON: reviewers_complete=false when ANY dispatched reviewer (incl. Devin) is skipped"
type: learning
topic: review-process
source: learnings/1783631862638-combined-review-result-json-reviewers-complete-fal.md
---

# combined-review RESULT_JSON: reviewers_complete=false when ANY dispatched reviewer (incl. Devin) is skipped

> **↪ Refined 2026-07-13 by [[1783707333659-approver-reviewers-complete-field-is-authoritative]]** — still true that a dispatched-but-incomplete reviewer makes the field `false`. But the approver keys on the LITERAL `reviewers_complete` value; a Reviewer-B/Devin *infra-skip alone* must NOT be auto-forced to false (that would push infra-abstain toward ~100%). See the newer note for the distinction.
# combined-review RESULT_JSON: reviewers_complete=false when ANY dispatched reviewer (incl. Devin) is skipped

The `/slang-pr-review` combined-report RESULT_JSON field `reviewers_complete` means "true **only if every _dispatched_ reviewer finished and drift==0**." A reviewer that was dispatched but did not complete — including Reviewer B (Devin) skipped for an environmental reason (Chrome can't launch, auth-wall, timeout) — makes the honest value **`false`**, which tells the approver to treat the run as harness-incomplete (→ lean ABSTAIN).

Bug observed on shader-slang/slang#12029: I set `reviewers_complete=true` while Devin was skipped. The `slang-pr-approver` caught the inconsistency (it didn't change that decision because Step-1 `head_provenance` was terminal, but it would matter on a same-repo PR where Step 2 runs). Fix: set `false` whenever B is skipped, and add a `reviewer_status` sub-object (`{A_correctness, B_devin, C_clarity: complete|skipped_*|failed}`) so the consumer sees exactly which reviewer is missing rather than inferring from a bare boolean.

Rule of thumb: `reviewers_complete = (A complete) && (B complete) && (C complete) && drift==0`. Devin skipped ⇒ false. Don't conflate "Reviewer A produced a valid review" with "all reviewers complete" — the boolean is about the whole panel.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1783631862638-combined-review-result-json-reviewers-complete-fal.md`_
