---
name: feedback_approver_never_posts_route_reviewer
description: "PR-approver never writes to GitHub even when instructed; don't tell it to post"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 57c9ef16-23a2-4177-94ad-2ee651561456
---

The `*-pr-approver` coworkers run in **shadow mode**: they record one auditable decision (WOULD_APPROVE | ABSTAIN_POLICY | ABSTAIN_INFRA | BLOCK) to the ledger and post **nothing**, merge nothing. Their role invariant forbids writing to GitHub *under any instruction*.

**Why:** posting is the reviewer coworker's job (COMMENT-state only, when the orchestrator authorizes via a review-trigger webhook). The approver's observability surface is the ledger + the later join against the human maintainer's verdict when the review/merge event routes back — not a public comment.

**How to apply:**
- When dispatching a `pr_ready_for_review` event to `*-pr-approver`, do NOT include "post the verdict on the PR" — it can't and won't. (I made this mistake on slangpy-samples#54; approver honored its invariant and reported the conflict.)
- If a public COMMENT-state footprint is genuinely wanted, route separately to `slangpy-reviewer` / `slang-reviewer`. But for a routine shadow-mode approval on a contributor PR, no public post is needed — that's the design.
- Related: [[feedback_github_writes_operator_authorized]], [[feedback_route_authorizations_through_dispatch_owner]], [[feedback_webhook_dispatch_by_event]].
