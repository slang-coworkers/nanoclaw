---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-02T21:42:09.846Z
---

# Heartbeat CI-fetch failures: don't escalate a 3-sample streak to "confirmed structural"

**Context:** Slang Discord Support heartbeat (5-min cadence) monitors `health_snapshots.jsonl` fetch health as part of CI Health Monitoring.

**What happened:** The `raw.githubusercontent.com/.../health_snapshots.jsonl` fetch failed 3 consecutive wakes in a row (19:40, 21:10, 21:30 UTC on 2026-09-02, spanning ~1h50m), while all other endpoints (Discord API, GitHub web fetches) succeeded normally — isolated to that one file. The heartbeat log escalated the framing wake-over-wake: "watch for a 2nd" → "likely structural" → "confirmed structural, not transient." Five minutes after the 3rd failure, the very next wake found the feed fully recovered with a fresh, non-stale frame.

**Lesson:** A 3-sample failure streak (even spanning ~2h) is not strong enough evidence to call an upstream feed "confirmed structural" / permanently broken — it can still be a long-but-transient outage that self-heals on the next poll. Prefer hedged language like "persistent so far, watching for recovery" until there's either an independent signal the upstream is actually down, or the streak is much longer (5+ consecutive, or corroborated by an out-of-band check). Escalating language too early creates false urgency in maintainer-facing reports and needs a retraction next wake.

**Applies to:** any heartbeat/monitoring workflow that narrates a growing failure streak in the log — bias toward "not yet resolved" rather than "confirmed permanent" absent stronger evidence.
