---
type: feedback
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
dispatch is luck, not a mechanism. Dated evidence for every rung:
[[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new_case_log]] — new cases go there,
not here.

## The check, in order

1. **`state` / `closed_at` / `state_reason` first.** A closed-as-withdrawn issue needs nothing.
   slang#12457 (2026-08-10) was closed **44 s** after filing with its body replaced by "Sorry I did
   not mean to press enter"; I had already dispatched a long brief off the payload. Its
   `updated_at` was 44 s from `created_at`, the freshest-looking issue possible, so a staleness
   heuristic would have passed it. **A deleted issue** returns an opaque
   `'str' object has no attribute 'get'` from `mcp__slang-mcp__github_get_issue`; use
   `gh api repos/<o>/<r>/issues/<N>` (HTTP **410**), then find the re-file by title — a sibling Main
   session owns the new number, so the deleted number's session dispatches nothing.
2. **Live `body` vs payload `body`** — and for a `pr_mention`, the live **comment** body and
   `updated_at` (`gh api .../issues/comments/<id>`). If they differ, the payload is not what the
   author stands behind. Never quote a webhook body as content or as "the maintainer's words": a
   quick self-edit is common, and it is exactly the retraction that matters.
3. **`comments_count`, an existing bot triage comment, `updated_at` far from `created_at`** — and
   whether **I already hold the chain** (canonical-thread session, `ncl tasks list | grep <num>`).
   slang#12316 (2026-08-07): created 08-01, triaged publicly 08-03, webhook arrived 6 days late; I
   put a second "please triage" on a thread whose top comment was the triage. If the chain is held,
   answer the operator from live state and send nothing to the triager or GitHub.
4. **The author, and whose work item it is.**
   - A human-filed body is a *report* that needs triage.
   - **Our** bot-filed body is a *verdict*: repro, SHA, isolated gate, dedup and an open fork already
     published, so `comments_count: 0` is correct forever and every check above passes it
     (slang#12461). It needs its owner found, not a fresh triage. Run
     [[technique_find_the_owner_of_a_bot_filed_issue_before_dispatching]].
   - **A maintainer-written plan that the maintainer owns is their work item, not a report**:
     self-assigned (or assigned to its author by a peer maintainer; read `/timeline` for the actor),
     with its own fix direction, "Done when", own PR, or code that exists only on their fork
     branch. Every rung above passes it. ⇒ Hold: no dispatch, no bot post (the bot waits on human
     issues, R6 #13596). Resume only on an @nv-slang-bot mention or an operator ask. A batch of N
     filings mints N Main sessions; one report covers the batch.
   - **A human report that arrives with the reporter's own open fix PR, or a maintainer assignee,** is
     held the same way, even when the reporter is not the assignee (slang-rhi#941/#942).
5. **Who the body @-mentions** (`pr_mention`). The webhook fires for any comment on a thread the
   bot touched, and **every human comment on a bot-authored issue arrives as `pr_mention`**. If it
   @-mentions another human, or nobody, it is not a summons: hold, no dispatch, no reaction, no
   post. A factual answer goes to the operator only, checked locally first. If that mention does
   what a pending operator question of ours proposed, close the question on the chain's dashboard
   thread and rewrite the owning re-chase task (`ncl tasks update`) so it stops re-asking.

## Why the routing tier owns this

A stale-webhook dispatch also aims at the wrong tier: the state holder, not a fresh triager, owns
the reply (closest-to-the-state). Under the shared bot identity a restating comment reads as the
same author echoing itself, so churn is worse than silence
([[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]],
[[feedback_sibling_write_under_shared_bot_identity]]). Batches of self-filed issues land minutes
apart, each minting its own Main session (#12460–#12462 in ~7 min), so "consistent with the
sibling's dispatch" is not the test.

The family pattern across all modes: **a correctly stated rule aimed at the wrong scope.**
This rule was first right about late payloads and silent about edited ones, then right about both
and silent about who wrote the issue, then silent about who it was addressed to.

Related: [[project_12316_type_layout_policy_duplication_techdebt]],
[[feedback_github_assigned_event_actor_is_the_assignee]].
