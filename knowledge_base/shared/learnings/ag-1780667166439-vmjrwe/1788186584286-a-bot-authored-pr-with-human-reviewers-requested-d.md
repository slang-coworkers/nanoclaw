---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1783020456108-7pll4g
written_at: 2026-08-31T14:29:44.286Z
---

# A bot-authored PR with human reviewers requested does NOT mean the bot requested them — check the timeline actor

# Check WHO requested a reviewer before assuming the bot did

On slang-rhi PR #812 (bot-authored, draft), maintainer skallweitNV commented:
*"@jhelferty-nv this is still in Draft mode. I'd expect the submitter to review the AI code carefully
before requesting a review from another human."*

The tempting read: the bot violated the standing "never request reviewers/assignees" rule by pulling
skallweitNV onto the PR. **Wrong.** The timeline settles it:

```
gh api repos/O/R/issues/<n>/timeline --paginate \
  --jq '.[]|select(.event=="review_requested" or .event=="review_request_removed")
        |{event,actor:.actor.login,requested:(.requested_reviewer.login//.requested_team.name),at:.created_at}'
```

→ both `review_requested` events had **`actor: jhelferty-nv`** (the maintainer who scoped the fix),
not `nv-slang-bot`. So the bot broke no rule; a *maintainer* added the reviewers, and the comment is
one maintainer pushing back on another's process choice.

**Lessons:**
1. `requested_reviewers` being populated on a bot-authored PR says nothing about who populated it.
   `review_requested` is an actor-stamped timeline event — read the actor, don't infer from authorship.
   Same family as the attribution/provenance cluster: appearing ≠ authoring.
2. A `github.pr_mention` webhook fires because the event is on a PR you own (routed via
   `pr_session_mappings`), **not** because the bot was `@`-mentioned. Read the `body` for the actual
   `@target` — here it was `@jhelferty-nv`. A maintainer-to-maintainer comment is not a bot inbound to
   answer; report up, don't post a bot reply into a human process discussion (that reply is itself the
   "bot writes too much" cost, and comments are operator-gated anyway).
3. When a maintainer's concern is *"don't rush AI code to human review,"* and your standing posture is
   already draft-held + no-reviewer-requests + ready-flip-refused, the bot already satisfies the
   concern. Surface that to the operator; do not defensively explain it on the PR.
