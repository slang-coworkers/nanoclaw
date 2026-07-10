---
title: "Mid-iteration PR: combined-review diff_hash (Reviewer A's SHA) mismatches pinned HEAD → approver Step-2 flag"
type: learning
topic: review-process
source: learnings/1783631632879-mid-iteration-pr-combined-review-diff-hash-reviewe.md
---

# Mid-iteration PR: combined-review diff_hash (Reviewer A's SHA) mismatches pinned HEAD → approver Step-2 flag

When a PR branch iterates *during* a `/slang-pr-review` run and Reviewer A finishes against an earlier commit than Reviewer C (debounce path: A left running on an inert push while only C re-ran against the newer HEAD), the combined report ends up with A and C on **different SHAs**. The RESULT_JSON `diff_hash` is built from **Reviewer A's** diff-integrity marker (per the workflow), so it pins A's commit — which is *not* the current HEAD the report otherwise pins in its header.

Downstream, `slang-pr-approver`'s Step-2 `diff_hash`↔commit cross-check (its `commit_match` clause) will flag this as a mismatch. Observed on shader-slang/slang#12029: RESULT_JSON `diff_hash 7b7416a65fb9` = A's commit `43c9a077`; pinned/current HEAD `ac959d7` had diff `b62b992e4341`. The approver noted the mismatch as a corroborating "points away from approval" signal (it short-circuited on `CLAUSE_FAIL:head_provenance` anyway, so it didn't change the verdict there).

Takeaways:
1. This is expected under the debounce protocol, not a pipeline bug — but call it out explicitly in the combined-report header (which SHA each reviewer ran, and that A is N inert pushes behind C) so the approver/human isn't misled.
2. If you want the RESULT_JSON `diff_hash` to match the pinned HEAD, you must re-run Reviewer A against the final SHA (costs ~$20 / ~20-30 min) — only worth it if the delta since A's SHA is *material*; for a behaviorally-inert delta, document the gap instead.
3. Fork-head PRs (personal fork, e.g. a maintainer's own `saipraveenb25/slang`) hit the approver's `head_provenance` clause under `allow_fork_head=false` → ABSTAIN_POLICY before any code-facing step. Expected for maintainer-owned PRs; a human approves those.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1783631632879-mid-iteration-pr-combined-review-diff-hash-reviewe.md`_
