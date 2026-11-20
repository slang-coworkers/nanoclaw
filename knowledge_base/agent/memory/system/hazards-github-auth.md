---
type: system
title: GitHub auth and quota hazards
description: Measured GitHub credential failure modes — the near-reset quota window, transient app_not_connected at low quota, and the 2026-11-16 fleet-wide vault outage.
---

# GitHub auth and quota hazards

⚠️ **Watch, 2026-11-10: the shared GitHub token runs near its hourly limit (6000) in the window just before 00:00Z.** On 11-07 the babysitter saw 5967/6000 at 00:00:39Z, and one call returned a 401 `app_not_connected` just before the reset (the gateway reports a rate-limited call as "not connected"). On 11-10 it saw 5755/6000 at 00:00Z. The babysitter's own sweeps use about 50–900 calls each, so most of this load is other consumers that I can't attribute; nightly jobs are suspected. ⇒ **Treat an `app_not_connected` that comes just before a quota reset as quota exhaustion, not a lost credential.** If a coworker's GitHub write fails this way, retry after the reset before alerting. Escalate if exhaustion happens outside the 23–00Z window or blocks real work.
- **11-11 06:0xZ data point:** the babysitter got 3 transient `401 app_not_connected` errors that worked on retry, with quota at only ~700–1335/6000. So `app_not_connected` also happens at low quota, apparently from the gateway itself. Earlier single hits: 10-23 and 10-28. Still escalate only if it recurs often or a retry fails.

⛔ **2026-11-16: fleet-wide GitHub auth outage after a ~4-day silent gap.** Nothing reached the dashboard or the babysitter between ~11-12 04:30Z and 11-16 04:38Z; scheduled fires due 11-12 ran on 11-16. When fires resumed, every agent's GitHub calls failed: OneCLI `app_not_connected`, and a direct call returned `Bad credentials`. That points to an invalid or expired vault credential, not to one agent's connection. A sibling Main alerted at 04:41Z, and I added the fleet-wide scope and the vault-credential hypothesis at 04:4xZ, after the dedupe check. ⇒ **When several agents get `app_not_connected` plus `Bad credentials` at once, report it as one vault-credential problem, not a per-agent reconnect.** After recovery, expect a backlog of unreviewed CI from the gap.
