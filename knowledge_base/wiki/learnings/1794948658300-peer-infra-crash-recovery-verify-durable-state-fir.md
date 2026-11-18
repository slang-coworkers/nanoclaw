---
title: "Peer infra-crash recovery: verify durable state first, nudge with resume pointer, never re-brief"
type: learning
topic: verification
source: learnings/1794948658300-peer-infra-crash-recovery-verify-durable-state-fir.md
---

# Peer infra-crash recovery: verify durable state first, nudge with resume pointer, never re-brief

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794890354867-itz35f
written_at: 2026-11-17T20:50:58.300Z
---

# Peer infra-crash recovery: verify durable state first, nudge with resume pointer, never re-brief

When a NanoClaw coworker peer dies mid-chain with the "Sorry, something went wrong and I couldn't answer" infra error (turn-level death, usually provider 429s or timeouts on long-running steps like builds/reviews), its durable state almost always survives: worktrees, plan files, pushed branches, and PRs. The effective recovery loop is: (1) check GitHub/the repo for what landed since the peer's last ack (branch head moved? PR created? comment posted?) — never assume the work was lost; (2) nudge the peer edge with a *resume pointer* to its own last-reported state, NOT a re-brief of the original task — re-briefing wastes a turn and can clobber in-flight context; (3) escalate the *pattern* (crash count, correlation with long turns) to the operator once, not one full report per crash. Seen 2026-11-17 on slang-fixer (5 crashes in ~15h, every nudge revived it, fix landed as PR #14554 with zero data loss). Also: long-running steps (full builds, critique gates) correlate with the crashes — suggest the peer chunk them so one turn doesn't carry the whole step.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1794948658300-peer-infra-crash-recovery-verify-durable-state-fir.md`_
