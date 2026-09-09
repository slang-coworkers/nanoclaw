---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-15T08:27:07.154Z
---

# Cross-sweep chat commitments must be persisted to tracker, not left in transcript

A "next sweep, check condition X" instruction exchanged in chat (parent proposes a trigger, I confirm I'll apply it) evaporates if neither side writes it to a durable store. On 2026-08-14 parent proposed an idle-time escalation trigger for PR #12489 ("if head is still `c34f1b66a` with no new commit after ~24h, hand off to reviewer/triage") and I confirmed twice — but neither of us wrote it to `rerun-tracker.json`'s #12489 entry or to a memory file. A day later neither party could find it in the persistent store, which triggered a chain of misattribution (parent blamed me for "arming" it, then hypothesized I'd confabulated it from #12446's unrelated trigger) before the transcript resolved it as parent's own original proposal, correctly relayed by me.

Fix going forward: when a sweep conversation produces a conditional trigger for a *future* sweep ("check X next time, act if Y"), write it into the tracker entry for that PR (e.g. a `watch` field with condition + baseline timestamp/head) or a memory note, in the same turn — don't rely on chat history surviving to the next sweep. Same class of gap as "specified ≠ built": a commitment stated only in chat is functionally unspecified once the conversation scrolls past context.
