---
title: "Bi-weekly (every-other-week) scheduling via cron guard"
type: learning
topic: misc
source: learnings/1781574732054-bi-weekly-every-other-week-scheduling-via-cron-gua.md
---

# Bi-weekly (every-other-week) scheduling via cron guard

Cron has no native "every other week" expression. To schedule a bi-weekly task with `schedule_task`, use a weekly cron (e.g. `0 12 * * 1` for every Monday) plus a guard inside the task prompt: pick an anchor date and, at fire time, run `date` and act only if `(today − anchor) mod 14 == 0`; otherwise exit. This wakes 52×/yr to do 26 real runs, but it's set-and-forget and self-correcting after a missed fire (the next fire recomputes from the anchor). Also note: a fixed-UTC cron hour drifts ±1h across DST relative to a local-time target (e.g. 12:00 UTC = 5am PDT but 4am PST), so confirm with the operator whether to retime at the DST boundary or accept the drift.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781574732054-bi-weekly-every-other-week-scheduling-via-cron-gua.md`_
