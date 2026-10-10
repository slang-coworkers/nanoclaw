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

### 2026-10-05, #13411: a `pr_mention` webhook can fire for a human @-mentioning another human
`github.pr_mention` on #13411 (our own docs-regen tracker) carried jhelferty-nv's comment *"@jvepsalainen-nv … I'm assuming it'll be fixed the next time you run the gen?"*. It didn't mention @nv-slang-bot. He had just assigned the issue to jvepsalainen-nv, who owns the regen runs. The procedure's "issue → triager" row would have dispatched a maintainer-to-maintainer question to the triager. ⇒ **Read who the body @-mentions before routing a `pr_mention`.** If it's another human, hold: no dispatch and no bot post. If it's a factual question we can answer, check the facts locally. Here `regenerate.py list-stale` on master already flagged misc.md and its test bundle, because `slang-ir-peephole.cpp` is a watched path. Then offer that answer to the operator, not to GitHub. Recorded the handoff in the owning re-chase task (`rechase-12249-13411-4260`).

### 2026-10-07, #13449: a `pr_mention` comment body is a snapshot too — re-read it before relaying
saipraveenb25 posted a two-point comment at 16:40:44Z and deleted point (ii) at 16:41:38Z. I quoted the webhook payload verbatim to
the triager and to the operator, and my report presented (ii) as part of his decision. The triager caught it by re-reading the live
comment. ⇒ **Before quoting a human comment as "the maintainer's words", `gh api .../issues/comments/<id>` and compare the live body
and `updated_at` with the payload.** A maintainer's quick self-edit is common and it is precisely the retraction that matters. The
same check as rung 2 above, aimed at comments instead of issue bodies.

### 2026-10-08, #13411: a dashboard "New issue to triage" can be about a chain I already hold
Three days after the hold above, `orchestrator-dashboard` sent a templated *"New issue to triage"* for #13411. The issue has no labels and no bot triage comment, because it's our own tracker and its triage is in the body. ⇒ **Before dispatching the triager, check the canonical-thread session and `ncl tasks list | grep <num>`.** If the chain is already held, answer the operator with the triage verdict from live state (subsystem, severity, owner, next step) and send nothing to the triager or GitHub. A triage comment would land in the middle of an open maintainer-to-maintainer exchange.

### 2026-10-10, #13557: deleted and re-filed as N+1 — the sibling Main owns the new number
jkwak-work filed #13557 at 23:58Z, deleted it, and re-filed the same body as #13558 at 00:01Z. Each filing minted its own Main
session. ⚠️ `mcp__slang-mcp__github_get_issue` on a deleted issue returns the opaque `'str' object has no attribute 'get'`,
not "deleted". Use `gh api repos/<o>/<r>/issues/<N>`, which returns **HTTP 410 "This issue was deleted"**. ⇒ **On a 410, search
for the re-file by title (`gh search issues "<title words>" --owner <org>`) and check its canonical-thread session.** If a sibling
Main holds it, dispatch nothing from the deleted number's session; the re-file's session routes it.
