---
title: "Tracker and Scheduler Hygiene"
type: concept
group: general-misc
tags: [trackers, scheduler, recurrence, nudge-scanner, watch-list, maintainer-reports, cron]
source_count: 0
---

# Tracker and Scheduler Hygiene

## TL;DR

- A carried-forward tracker must record each item's **disposition** (active / de-escalated-monitor / retired), reasoning, and who/when — not just the item. A fresh session re-derives state from raw facts every run and re-raises alarms a human already dispositioned.
- Give every tracker an explicit "do NOT re-flag" section and a header rule that a human's evidence-backed de-escalation **overrides** what the raw window re-derives.
- **Re-read the tracker file before reporting status.** A report's prose summary drifts from actual file state; never trust a carried-forward narrative.
- An open P0 / ship-stopper must appear in **every** daily report until it reaches a terminal state (merged/closed). Fetch windows (e.g. 24h) silently drop long-open items — carry them forward from a persistent watch-list file with freshly-verified live state.
- Retire a watch-list entry only on merge/close or explicit human de-escalation.
- A stalled scheduled occurrence **freezes the whole recurrence**: a recurring task mints its NEXT occurrence only when the current one COMPLETES, so one un-fired `pending` row halts the entire series. Re-arm with `update_task({taskId, processAfter})`.
- Don't conflate independent pipelines: a daily raw-learnings sync can be pushing commits while a separate wiki-synth task is stalled and `wiki/` is frozen. Diagnose by comparing counts.
- Express bi-weekly (every-other-week) recurrence with a **cron guard** that fires weekly but skips off-weeks, rather than a native alternating cadence.
- A nudge/supervisor scanner's work-set must **fail closed**: a failed state fetch must "skip / escalate," never default to OPEN — defaulting to OPEN resurrects archived/closed chains into nudges.
- Validate the must-nudge **predicate against true disposition** before dispatching. Deriving "needs a nudge" from a proxy (e.g. an absent comment body read as bot activity) over-counts the population you act on (observed 146 vs 21).

## Trackers must carry disposition, not just items

For any periodic agent maintaining a carried-forward tracker (watch-list, status board), the file must record each item's **disposition**, reasoning, and who/when — not just the item itself. A fresh session re-derives state from raw source facts every run and keeps re-raising alarms that a human already dispositioned. The fix: structure every tracker entry with a leading Disposition line (active / de-escalated-monitor / retired), an explicit "do NOT re-flag" section for de-escalated items, and a header rule that a human's evidence-backed de-escalation **overrides** what the raw window re-derives ([Recurring trackers must carry disposition + reasoning, not just items](../learnings/1782461882511-recurring-trackers-must-carry-disposition-reasonin.md)).

⚠️ The prose summary inside a report drifts from the actual file state over time. When maintaining a long-lived tracker, **re-read the tracker file before reporting status** rather than trusting a carried-forward narrative ([Watch-list prose summaries drift from file state; re-read the file before reporting status](../learnings/1784153749839-watch-list-prose-summaries-drift-from-file-state-r.md)).

## Daily reports must carry open ship-stoppers forward

An open P0 / ship-stopper fix must appear in **every** daily maintainer report until it reaches a terminal state (merged/closed). A PR opened more than 24 hours ago and still in review falls outside the 24h merge/open window used by the fetch query and silently drops off. Keep a persistent watch-list file; at the start of every daily report, read it and carry every still-open entry forward with **freshly-verified live state**. Retire an entry only on merge/close or explicit human de-escalation ([daily maintainer report must carry open ship-stoppers until merged](../learnings/1781598056955-daily-maintainer-report-must-carry-open-ship-stopp.md)).

## Recurrence-advance and pipeline hygiene

⛔ A stalled scheduled *occurrence* freezes the whole recurrence. A recurring task only mints its NEXT occurrence when the current one COMPLETES, so one un-fired `pending` row halts the entire series — all daily tasks froze at 07-03/07-04 while the 12-hourly supervise task stayed current. Re-arm with `update_task({taskId, processAfter})`.

Do not conflate the two independent `knowledge_base` pipelines: the daily *raw-learnings* sync (`knowledge_base sync ...` commits) pushes `shared/learnings/` but runs **no** wiki synth, so "learnings are being pushed" can be true while `wiki/` is frozen because the separate wiki-synth task stalled. Diagnose by comparing counts on nv-coworkers. Also, when folding uncovered learnings, first split "genuinely new" from "already in a concept page" (`grep -l <stem> wiki/concepts/`) before writing synthesis, and resolve every truncated filename stem to its real file before scripting `[[...]]` links or they dangle ([learnings-wiki coverage-checker miscounts bracket-titled learnings + stalls freeze the whole recurrence](../learnings/1783327563514-learnings-wiki-coverage-checker-miscounts-bracket-.md)).

## Bi-weekly scheduling via a cron guard

Express every-other-week (bi-weekly) recurrence with a cron guard that fires each week but **skips the off-weeks**, so the scheduler only wakes the agent on the intended alternating cadence rather than on every occurrence ([Bi-weekly (every-other-week) scheduling via cron guard](../learnings/1781574732054-bi-weekly-every-other-week-scheduling-via-cron-gua.md)).

## Nudge scanners: fail closed and validate the predicate

⛔ A nudge/supervisor scanner's work-set must **fail closed, not default to OPEN**. A failed fetch that defaults to OPEN resurrects archived chains into nudges — a scanner that treats a fetch error as "still open" will re-nudge chains that were already closed, so the failure mode of the state read must be "skip / escalate," never "assume live" ([A failed fetch defaulting to OPEN resurrects archived chains into nudges](../learnings/1786150583873-a-failed-fetch-defaulting-to-open-resurrects-archi.md)).

✅ The counting counterpart: `scan.py` read an absent comment body as automation activity and inflated the must-nudge set to **146 vs 21**. A scanner that derives "needs a nudge" from a proxy (an empty body read as a bot post) over-counts the population it will act on. Validate the must-nudge predicate against the **true disposition** before dispatching, or the tracker nudges dozens of chains that need nothing ([scan.py absent-body read as automation inflated must_nudge 146 vs 21](../learnings/1786149497107-scan-py-absent-body-read-as-automation-inflated-mu.md)).

**Source learnings (7):**
- [Recurring trackers must carry disposition + reasoning, not just items](../learnings/1782461882511-recurring-trackers-must-carry-disposition-reasonin.md) — structure each tracker entry with disposition, reasoning, and a "do NOT re-flag" section; human de-escalation overrides re-derived state
- [Daily maintainer report must carry open ship-stoppers until merged](../learnings/1781598056955-daily-maintainer-report-must-carry-open-ship-stopp.md) — carry open P0s forward from a persistent watch-list with fresh live state; fetch windows silently drop long-open items
- [learnings-wiki coverage-checker miscounts + stalls freeze the whole recurrence](../learnings/1783327563514-learnings-wiki-coverage-checker-miscounts-bracket-.md) — one un-fired occurrence halts the series; raw-learnings sync and wiki-synth are independent pipelines
- [Watch-list prose summaries drift from file state; re-read the file before reporting status](../learnings/1784153749839-watch-list-prose-summaries-drift-from-file-state-r.md) — re-read the tracker file before reporting rather than trusting a carried narrative
- [Bi-weekly (every-other-week) scheduling via cron guard](../learnings/1781574732054-bi-weekly-every-other-week-scheduling-via-cron-gua.md) — fire weekly, skip off-weeks with a cron guard for alternating cadence
- [A failed fetch defaulting to OPEN resurrects archived chains into nudges](../learnings/1786150583873-a-failed-fetch-defaulting-to-open-resurrects-archi.md) — nudge scanner work-set must fail closed (skip/escalate), never assume live
- [scan.py absent-body read as automation inflated must_nudge 146 vs 21](../learnings/1786149497107-scan-py-absent-body-read-as-automation-inflated-mu.md) — validate the must-nudge predicate against true disposition; proxies over-count the acted-on population
