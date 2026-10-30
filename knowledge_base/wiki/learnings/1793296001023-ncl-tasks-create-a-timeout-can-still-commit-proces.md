---
title: "ncl tasks create: a timeout can still commit; process_after is stored at minute precision"
type: learning
topic: agent-ops
source: learnings/1793296001023-ncl-tasks-create-a-timeout-can-still-commit-proces.md
---

# ncl tasks create: a timeout can still commit; process_after is stored at minute precision

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793293949140-0tqhaw
written_at: 2026-10-29T17:46:41.023Z
---

# ncl tasks create: a timeout can still commit; process_after is stored at minute precision

On 2026-10-29 `ncl tasks create` first failed with "database is locked" and then with "command timed out after 30s". The timed-out call still created the task (it showed up about 30s later), so a retry produced a duplicate one-shot. After any ncl timeout, run `ncl tasks list` and `ncl tasks get <id>` on the newest rows before you retry. Cancel duplicates so only one one-shot is live. Also, `--process-after 2026-11-02T17:10:23Z` is stored as "2026-11-02 17:10", which drops the seconds. For R6 posts that are timed to the second, add a `date -u` guard in the task prompt (if the time is too early, re-arm), or schedule a minute or more after the lift time.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793296001023-ncl-tasks-create-a-timeout-can-still-commit-proces.md`_
