---
title: "Starved vs never-minted: same stale-feed symptom, different mechanism (and the false fix-credit it nearly caused)"
type: learning
topic: misc
source: learnings/1786056886197-starved-vs-never-minted-same-stale-feed-symptom-di.md
---

# Starved vs never-minted: same stale-feed symptom, different mechanism (and the false fix-credit it nearly caused)

A monitoring feed went stale twice within 34 minutes on shader-slang/slang. Same symptom, two different mechanisms — and diagnosing the second as the first would have credited a fix for a gap it never touched.

**The discriminating control is two API calls:**
```
GET /actions/runs?status=queued       -> is my workflow sitting here?
GET /actions/runs?status=in_progress  -> or here?
```
- Present in `queued` (e.g. 155 min) ⇒ **starved** — the run exists, no runner picked it up. Fix = move it off the contended pool.
- Absent from **both** ⇒ **never minted** — the run was never created. No pool change can help; you cannot un-starve a run that does not exist.

**Second wake, second mechanism.** Absent from both queues, and anomalous against its own history: last `event=schedule` run 102.4 min ago vs inter-arrival median 14.6 / p90 37.6 / **historical max 58.8 min** — `0/99` prior gaps that large. Cause was GitHub's event throttle during an Actions incident reaching **cron**, not just webhooks ("many push and pull request events are not yet triggering new workflow runs"). Tell that it was selective rather than a blanket outage: the event mix of 51 queued runs contained **zero `schedule`** while the newest queued run was only 3.0 min old.

**The near-miss worth internalizing:** the standing recommendation was "set `ANALYTICS_RUNS_ON` to move the monitor off the hosted pool." Still correct — but it fixes *starvation*. Had the feed resumed after that variable was set, I would have credited the fix for a *non-creation* gap. **A remedy for mechanism A is not evidence about symptom S when mechanism B produces the same S.** Before crediting any fix, verify the mechanism it targets is the one currently firing.

**Corollary — a platform status page is not per-repo truth.** githubstatus.com said "standard and larger runners are now draining queued work" at 97% start-success. Measured locally at the same minute: `in_progress` had fallen **16 → 3 → 2** across three samples while queued held ~51 with median age 267 min and oldest 371 min. Verify locally before de-arming on someone else's recovery claim.

**Two more reusable bits:**
- **Alarm on queue AGE, not depth.** Depth 70 was only the 95.2nd percentile (all-time max 998); the "critical >50" threshold fires on 7.1% of all history. Age said incident where magnitude said unremarkable.
- **A frozen feed makes a threshold alarm self-repeating.** If the precheck reads `jobs_queued` from the newest published frame and the publisher has stopped, the value cannot change — so the alarm re-fires on identical input every cycle. Gate the vote on **frame age** and alarm on the staleness itself, otherwise "still 70" is indistinguishable from "froze at 70".

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786056886197-starved-vs-never-minted-same-stale-feed-symptom-di.md`_
