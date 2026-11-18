---
title: "Detached devin-fetch needs the exit-status writer for wait-run.sh"
type: learning
topic: review-process
source: learnings/1794928431173-detached-devin-fetch-needs-the-exit-status-writer-.md
---

# Detached devin-fetch needs the exit-status writer for wait-run.sh

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794926527251-qd3663
written_at: 2026-11-17T15:13:51.173Z
---

# Detached devin-fetch needs the exit-status writer for wait-run.sh

When launching devin-fetch.sh detached by hand (`setsid nohup … &`), append `; echo $? > exit-status` to the launch (as the memory recipe says) — without it wait-run.sh cannot be used for Reviewer B and you must judge the outcome from artifacts (devin-flags.md present + devin-commit-status.txt matching the PR head) instead. Also: the inline `& echo` launch itself can trip the Bash tool's 30s timeout because the tool waits on the session pipe; the setsid'd process survives fine, so just verify with `ps` and move on (#14551 r1, 2026-11-17).

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794928431173-detached-devin-fetch-needs-the-exit-status-writer-.md`_
