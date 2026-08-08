---
name: feedback-issue-opened-webhook-is-not-evidence-the-issue-is-new
description: "An issue_opened webhook can arrive days late; check live issue state/comments before dispatching triage, or you re-request completed work"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2d9038c4-8bf6-4c7f-a7b7-616593be4b73
---

# `issue_opened` does not mean "not yet triaged"

**Measured 2026-08-07:** received `github.issue_opened` for slang#12316 and dispatched a full triage request to `slang-triager`. The issue was opened **2026-08-01** and had been **triaged 2026-08-03** — a substantial public comment (source-read at `53b76e6d3`, 3 cheapest-first options, Issue Type set to `Refactoring`). The webhook was ~6 days stale. `comments_count: 2` was already on the issue at dispatch time.

**Why:** webhook `event` names the *originating* action, not the current state. Delivery latency, replay, and backfill all produce `issue_opened` for issues that have since moved on. My dispatch cost the triager a redundant-work decision and put a second "please triage" on a thread whose triage was the top comment.

**How to apply:** for ANY issue/PR webhook, one read of live state before dispatching — `github_get_issue` and look at `comments_count`, `updated_at` vs `created_at`, and whether a bot triage comment already exists. Cheap (one call) and it decides the routing: fresh → triage; already triaged → route the *new* input to whoever holds the state.

⭐ **The tell is `updated_at` far from `created_at`** on a supposedly-new issue. #12316: created `2026-08-01T22:18:04Z`, updated `2026-08-07T19:03:38Z`.

Related: the closest-to-the-state principle means a stale-webhook dispatch also aims at the wrong tier — the state holder, not a fresh triager, owns the reply. See [[project_12316_type_layout_policy_duplication_techdebt]].
