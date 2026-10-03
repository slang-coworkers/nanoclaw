---
name: feedback-issue-opened-webhook-is-not-evidence-the-issue-is-new
description: "issue_opened webhook is a past action, not current state; read live state (state/closed_at FIRST, then comments) before dispatching, or you triage a withdrawn or already-triaged issue"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2d9038c4-8bf6-4c7f-a7b7-616593be4b73
---

# `issue_opened` does not mean "not yet triaged"

A webhook payload is a **snapshot of a past action**. Delivery latency, replay and backfill
produce `issue_opened` for issues that have moved on, and the body and state can both change
before I read them. So before routing any issue/PR webhook, make one live read
(`github_get_issue`) and decide from it, at the routing tier. The working tier catching a bad
dispatch is luck, not a mechanism.

## The check, in order

1. **`state` / `closed_at` / `state_reason` first.** A closed-as-withdrawn issue needs nothing.
   slang#12457 (2026-08-10) was closed **44 s** after filing with its body replaced by "Sorry I did
   not mean to press enter"; I had already dispatched a long brief off the payload. Its
   `updated_at` was 44 s from `created_at`, the freshest-looking issue possible, so a staleness
   heuristic would have passed it.
2. **Live `body` vs payload `body`.** If they differ, the payload is not what the reporter stands
   behind. Never quote a webhook body as content: my verbatim brief republished a retracted report.
3. **`comments_count`, an existing bot triage comment, `updated_at` far from `created_at`.**
   slang#12316 (2026-08-07): created 08-01, triaged publicly 08-03, webhook arrived 6 days late; I
   put a second "please triage" on a thread whose top comment was the triage.
4. **The author.** A human-filed body is a *report* that needs triage. **Our** bot-filed body is a
   *verdict*: repro, SHA, isolated gate, dedup and an open fork already published, so
   `comments_count: 0` is correct forever and every check above passes it (slang#12461). It needs
   its owner found, not a fresh triage. Run
   [[technique_find_the_owner_of_a_bot_filed_issue_before_dispatching]].

## Why the routing tier owns this

A stale-webhook dispatch also aims at the wrong tier: the state holder, not a fresh triager, owns
the reply (closest-to-the-state). Under the shared bot identity a restating comment reads as the
same author echoing itself, so churn is worse than silence
([[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]],
[[feedback_sibling_write_under_shared_bot_identity]]). Batches of self-filed issues land minutes
apart, each minting its own Main session (#12460–#12462 in ~7 min), so "consistent with the
sibling's dispatch" is not the test.

The family pattern across all three modes: **a correctly stated rule aimed at the wrong scope.**
This rule was first right about late payloads and silent about edited ones, then right about both
and silent about who wrote the issue.

Related: [[project_12316_type_layout_policy_duplication_techdebt]].
