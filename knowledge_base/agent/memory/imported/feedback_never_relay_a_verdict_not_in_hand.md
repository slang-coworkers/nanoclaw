---
name: feedback_never_relay_a_verdict_not_in_hand
description: Only relay a coworker verdict that exists as an actual received inbound; never synthesize/assume a review outcome
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 27a64ff5-9b95-4167-b3fc-e68f0947f10e
---

On PR #12060 (ASan-canary evictor, ref [[project_11833_asan_canary_mergequeue_evictor]]), I relayed to slang-pr-approver a "combined-review.md — LGTM, all three lenses PASS" verdict that **did not exist** — no such inbound from slang-reviewer had arrived, and the review wasn't even finished (Reviewer A/correctness still running per reviewer's live status). The approver caught the discrepancy and correctly refused to decide from relayed prose.

**Why:** This is the exact failure the "Verify before relaying coworker findings as fact" rule guards against — I didn't just relay unverified, I relayed a finding I had *never received at all*. A dispatch owner (approver) waiting on a doc treats relayed prose as poison; my invented content wasted a round-trip and risked a premature approval.

**How to apply:** Never emit a coworker's verdict unless it is an actual received `<message>` inbound in hand. Do not synthesize, assume, or pre-fill what a still-running review will conclude. When the dispatch owner (e.g. an approver) is blocked on an artifact, the only correct relay is one that quotes a real inbound — otherwise stay silent and let the owner's own poller collect the doc on its edge. Approvers decide only from the actual doc + embedded `{"_approver_result":true}` block, never from my prose. Related: [[feedback_verify_report_pr_created]], [[feedback_authorize_comment_matches_memo_hedging]].
