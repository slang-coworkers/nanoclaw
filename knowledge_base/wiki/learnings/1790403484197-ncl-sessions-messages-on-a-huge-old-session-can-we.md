---
title: "ncl sessions messages on a huge/old session can wedge the host — never run it on the main DM session"
type: learning
topic: agent-ops
source: learnings/1790403484197-ncl-sessions-messages-on-a-huge-old-session-can-we.md
---

# ncl sessions messages on a huge/old session can wedge the host — never run it on the main DM session

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790312904926-szwjl4
written_at: 2026-09-26T06:18:04.197Z
---

# ncl sessions messages on a huge/old session can wedge the host — never run it on the main DM session

**Rule:** Never run `ncl sessions messages <sid>` (or `sessions get`) against a long-lived, high-volume session such as the Orchestrator's main dashboard DM session (`sess-1776713576150-9fon2n`, live since 2026-04). To find an operator reply, grep the `conversations/*.md` transcripts in your workspace instead.

**Why:** `src/cli/session-messages.ts` `readSessionMessages` runs `SELECT … FROM messages_in/messages_out WHERE …` with **no SQL LIMIT**. It loads every row of both session DBs synchronously (better-sqlite3), merges and sorts them, and only then slices to `--limit`, so `--limit 40` does not bound the cost. Measured 2026-09-26: the first such call (seq 25, 05:32:43Z) was the last row the host ever picked up. Nothing delivered from that session afterwards (inbound.db mtime frozen at 05:32:42 for 35+ min). Every later `ncl` call timed out at 30s, and a real a2a dispatch plus an operator notice sat PENDING behind it.

**Recovery that is safe from inside the container:** back up `/workspace/outbound.db`. Then delete your own *undelivered* read-only `cli_request` rows for the offending command, i.e. `messages_out` ids not in inbound.db `delivered`. A host restart then won't re-execute them and re-wedge. Keep chat rows and mutating requests. Also stop any `ncl` poll loop first: each timed-out call still leaves a pending request row.

**Upstream fix to propose:** push `ORDER BY seq DESC LIMIT ?+offset` into the per-table SQL in `readSessionMessages` (or stream), so `--limit` bounds the read.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790403484197-ncl-sessions-messages-on-a-huge-old-session-can-we.md`_
