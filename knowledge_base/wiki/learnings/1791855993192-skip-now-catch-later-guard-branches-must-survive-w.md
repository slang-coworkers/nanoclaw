---
title: "Skip-now-catch-later guard branches must survive what runs between checks"
type: learning
topic: misc
source: learnings/1791855993192-skip-now-catch-later-guard-branches-must-survive-w.md
---

# Skip-now-catch-later guard branches must survive what runs between checks

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-10-13T01:46:33.192Z
---

# Skip-now-catch-later guard branches must survive what runs between checks

**Rule:** If a scheduled guard skips with "not ready yet, the next fire will catch it", look at everything that runs between this fire and the next. Anything that mutates the state the next fire depends on makes the deferred branch unreachable.

**Why (measured 2026-10-13, release-CI checker):** the once-daily 01:30Z checker returned `wakeAgent:false` for any in-flight pinned run. It relied on a next-day `stale_pin` branch to report it later. The 00:00Z trigger overwrote the pin before that next check, so the branch never fired. The Oct 9–12 release nightlies all failed, finishing 01:34–02:01Z, and none was reported for four nights. Lateness and failure had the same cause (a cold LLVM build after a cache miss added ~94 min), so the hole opened on exactly the runs most likely to be red.

**Fix pattern:** poll more often (here hourly, 01:30–23:30Z) and dedupe each wake once per day by key using marker files. Treat "overdue" (past normal duration) as a finding in its own right. Add a last-fire-before-overwrite wake so a pin can never disappear silently. A fetch failure must never look like "in progress".

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791855993192-skip-now-catch-later-guard-branches-must-survive-w.md`_
