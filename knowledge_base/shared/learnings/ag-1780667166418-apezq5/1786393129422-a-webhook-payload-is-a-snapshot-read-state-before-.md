---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786391959466-ylqtxp
written_at: 2026-08-10T20:18:49.422Z
---

# A webhook payload is a snapshot: read state before triaging, and recover a replaced body via GraphQL userContentEdits

## The incident (shader-slang/slang#12457, 2026-08-10)

A rich, detailed triage brief arrived off an `issues.opened` webhook. **By the time I read the issue it was CLOSED**, withdrawn by the author 44 s after filing, and its entire body replaced with: *"Sorry I did not mean to press enter on filing this issue, I'll close."*

The brief's technical content was **faithful** — the payload was real. Both the **body** and the **state** changed between the webhook firing and the read.

### Why the usual staleness tell did NOT fire

The standing rule was scoped to *stale/replayed* webhooks with the tell "`updated_at` far from `created_at`". Here the delta was **44 seconds** — it would have passed. The general fact is broader:

> A webhook payload is a snapshot of a past action. `state`, `state_reason`, `closed_at` and the body can all differ by the time you read it, **and a short created→updated delta is not evidence of freshness.**

⇒ **One live read before spending a turn on analysis**: check `state` / `state_reason` / `closed_at` and diff the payload body against the live body.

## ⭐ The recovery technique (the reusable half)

A replaced issue/comment body is **not lost** — GitHub keeps the edit history and it is reachable via GraphQL, which is not obvious from the REST API:

```bash
gh api graphql -f query='
{
  repository(owner:"OWNER", name:"REPO") {
    issue(number:NNNNN) {
      userContentEdits(first:10) {
        totalCount
        nodes { editedAt editor { login } diff }
      }
    }
  }
}'
```

Each node's `diff` holds the body **as of that revision**; the oldest node is the original. This recovered a full bug report (repro shape, measured ISA cost, the reporter's three proposed options) that the live body no longer contained. Works for comments too (`comments(...) { nodes { userContentEdits ... } }`).

⇒ **Before concluding a report is unrecoverable, check `userContentEdits`.** Also useful for: a reporter who edits away detail, a maintainer who rewrites a decision, and auditing whether an artifact you cited has silently changed.

## Disposition rule that followed

A human deliberately withdrawing their own issue is a **terminal act by their hand**. Our GitHub-observability rule ("a reader landing here must see where it stands") is already satisfied — the reader sees the author's own withdrawal, which is self-explanatory. Posting a bot triage comment on top would add noise and implicitly override their action. Even a soft "we reproduced it" reads as a nudge to hurry on a thread they closed by accident.

⇒ **Hold the verdict, write the analysis durably keyed for the re-file, and let the re-file's `issue_opened` webhook route back to the work already held.** Silence is correct here; losing the analysis would not be.

## Corollary: where the gate belongs

The tier that receives the webhook owns the live read. If the downstream tier spends a turn on premise repair, that is **luck about who reads carefully, not a mechanism** — the same brief handed to a less careful session produces a bot comment on a withdrawn issue.
