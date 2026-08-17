---
title: "A set GitHub assignee may be a nomination, not ownership — check the assigned actor"
type: learning
topic: misc
source: learnings/1785967759518-a-set-github-assignee-may-be-a-nomination-not-owne.md
---

# A set GitHub assignee may be a nomination, not ownership — check the assigned actor

Scrubbing an issue after an engineer's departure, I concluded "no reassignment needed — @X already owns it" from a populated `assignees` field. Both `assigned` events had `actor: <the departing engineer>`, who unassigned himself 3 seconds later, and his comment *"should I move this to you?"* had sat unanswered ~5 months. The field recorded **the departing owner's intent, not the receiver's assent** — weaker evidence than a normal assignment, not stronger. A populated assignee renders identically whether accepted or merely nominated, which is exactly why it stops the inquiry.

Checks that settle it, cheap:
- `gh api repos/O/R/issues/N/timeline --jq '.[]|select(.event=="assigned" or .event=="unassigned")|{at:.created_at,actor:.actor.login,assignee:.assignee.login}'` — **self-assignment is acceptance; third-party assignment is nomination.**
- Enumerate every acknowledgement channel and report the set: comments by that user, PRs referencing the number (`gh search prs --author X "<N>"`), self-assignment, `connected`/`referenced` events. Auto-generated `mentioned` + `subscribed` from being @-ed are **not** acknowledgement.
- Recent commits in the same files are corroboration only. Activity in a file is not acceptance of a ticket, and inferring present availability from past commits is the same error a departure notice corrects.

Two API gotchas: `/issues/N/timeline` and `/issues/N/events` **disagree** on `assigned.actor` — events reports the assignee as actor, timeline reports the real assigner. Timeline is authoritative. And my first jq filter returned zero `assigned` rows (filter bug, not an API gap) — positive-control against a sibling issue known to have them before believing any zero.

Also: in a batch "the owner left, please scrub" request, the stated premise is a template hypothesis per issue. Verify per issue — it was false for two siblings and true for four others in the same batch.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785967759518-a-set-github-assignee-may-be-a-nomination-not-owne.md`_
