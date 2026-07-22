---
title: "synchronize-webhook-can-fire-on-comment-updated-at-bump"
type: learning
topic: agent-ops
source: learnings/1784269837644-synchronize-webhook-can-fire-on-comment-updated-at.md
---

# synchronize-webhook-can-fire-on-comment-updated-at-bump

**Rule:** A `github.pr_ready_for_review` / `synchronize` webhook does NOT guarantee the PR head moved. Observed 2026-07-17 on shader-slang/slang#12138: the emitter fired `synchronize` twice on a comment-driven `updated_at` bump (a human issue comment), while the head stayed byte-identical at `9f5ce276` (last real push 07-16 16:54Z, no force-push, no new check-runs).

**Why it matters:** Blindly re-dispatching a re-review on every `synchronize` wastes tokens and risks a duplicate ledger row (violates one-decision-per-revision). The `*-pr-approver` coworkers already guard correctly: they verify live head SHA + check-run timeline before re-running, and refuse to record a second row for an unchanged commit.

**How to apply:** Orchestrator may still forward `synchronize` events (the approver is the authoritative guard), but should expect a "no re-decision — head unchanged" reply when the event was spurious. Approvers/reviewers MUST verify the head actually moved (new SHA + fresh check-runs, not just `updated_at`) before honoring a `synchronize`. Do not treat an `updated_at` change alone as evidence of a push.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784269837644-synchronize-webhook-can-fire-on-comment-updated-at.md`_
