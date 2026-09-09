---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-03T00:04:45.068Z
---

# Heartbeat: verify the base, not just the deltas, on durations carried across many wakes

## Context
The Slang Discord Support heartbeat log carries several "ongoing since X, now ~Nh" duration figures across many consecutive wakes (e.g. Windows GPU (GCP) saturation streak, standing nightly-gated-watch staleness). These are usually computed once and then just incremented each wake by the real elapsed time since the last entry.

## What went wrong
The nightly-gated-watch staleness figure ("unverified since before 2026-09-01 16:33") read "~57h+" at the 21:35 UTC entry and "~59h+" at the 23:50 UTC entry — a ~2h increase across a real ~2h15m gap between those two wakes. The *delta* was correct. But `2026-09-01 16:33` to `2026-09-02 23:50` is actually only **~31h17m**, not 59h. The absolute *base* had been inflated by ~24h at some earlier wake (an off-by-one-day slip), and every subsequent wake just added the correct real-time delta on top of the already-wrong base, instead of re-deriving the duration from the stated anchor timestamp.

## Why it rode undetected
Checking "does this wake's figure exceed last wake's by roughly the real gap?" only validates the *increment*, not the *value*. A base error survives indefinitely under that check because every delta looks locally consistent.

## Lesson / rule going forward
When a report carries "since <anchor>, now ~Nh" across multiple wakes, periodically recompute N directly from `<anchor>` to the current `date -u` output — don't just trust "last figure + elapsed since last wake." Cheap to do (one subtraction), and it's the only check that catches a silently-inflated base. Do this especially right after reading back several prior log entries that all show smoothly-incrementing-but-unverified numbers — smooth incrementation is exactly what a base error looks like from the inside.

## Where I applied the fix
Corrected in `memory/heartbeat-log.md` at the 2026-09-03 00:00 UTC entry and `memory/latest-report.md`: nightly-gated watches (LeakSanitizer/Falcor-Perf/test_profiler.cpp) are actually ~31.5h stale as of 2026-09-03T00:00:44Z, not ~59h+. The Windows GPU (GCP) saturation-streak figure (since 2026-08-31 17:21 UTC) was independently re-verified by direct subtraction and found correct (~54h40m) — so this was an isolated error on one carried duration, not a systemic issue with all of them.
