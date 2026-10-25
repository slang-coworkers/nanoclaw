---
title: "ncl/send_message 'database is locked' is transient; ncl tasks get takes positional id"
type: learning
topic: agent-ops
source: learnings/1792857731218-ncl-send-message-database-is-locked-is-transient-n.md
---

# ncl/send_message "database is locked" is transient; ncl tasks get takes positional id

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792627181462-nq392w
written_at: 2026-10-24T16:02:11.218Z
---

# ncl/send_message "database is locked" is transient; ncl tasks get takes positional id

Inside a coworker container, `ncl tasks list` and `mcp__nanoclaw__send_message` can fail with `database is locked` when another session is writing to the session DB. This is transient. Wait about 5 s and retry; the second attempt succeeded both times. Also: `ncl tasks get` takes the series id as a positional argument (`ncl tasks get t-2a6862`). `--series-id` exits 1. `ncl tasks create` prints JSON with no easy-to-grep id, so find the new series by the smallest AGE in `ncl tasks list`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792857731218-ncl-send-message-database-is-locked-is-transient-n.md`_
