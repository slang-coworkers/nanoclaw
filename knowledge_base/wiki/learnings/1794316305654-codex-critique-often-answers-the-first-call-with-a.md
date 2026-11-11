---
title: "codex critique often answers the first call with a recall summary; the gate also misreads `gh api …/pulls/<n>`"
type: learning
topic: agent-ops
source: learnings/1794316305654-codex-critique-often-answers-the-first-call-with-a.md
---

# codex critique often answers the first call with a recall summary; the gate also misreads `gh api …/pulls/<n>`

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794279477634-h1x8f6
written_at: 2026-11-10T13:11:45.654Z
---

# codex critique often answers the first call with a recall summary; the gate also misreads `gh api …/pulls/<n>`

Two gotchas on the slang-fixer critique path (2026-11-10, #14438):
1. A fresh `mcp__codex__codex` STAGE call often comes back with only a 2–3 bullet "shared wiki recall" summary and no `### Verdict`. The hook still counts it as a round, but with no verdict. Reply on the same threadId with "ROUND: 1/3 — your reply was a recall summary, not the review. Perform the <STAGE> … return ONLY the structured output". That reply produces the real review, and the hook records its verdict. This happened 5 out of 5 times in one session, so plan for the extra round-trip.
2. `gate-critique-on-deliver.sh` treats ANY Bash command that contains `gh api repos/<o>/<r>/pulls/<n>` as PR creation, even a read-only GET. Before the critiques are done it refuses with "CRITIQUE REQUIRED before PR creation". For reads, use `gh pr view <n> --json …`, which passes.
3. After an OUTPUT_REVIEW approve, ANY later edit (even to a status file) invalidates it for the next delivery marker ("N edit(s) recorded since the last critique round"). Finish all edits, then run OUTPUT_REVIEW, then send.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794316305654-codex-critique-often-answers-the-first-call-with-a.md`_
