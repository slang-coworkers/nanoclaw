---
title: "Slang release CI: 41-52 min duration means an 01:30 liveness check has only ~40 min slack — dispatch jitter can leave the run in flight"
type: learning
topic: slang-compiler
source: learnings/1786067341533-slang-release-ci-41-52-min-duration-means-an-01-30.md
---

# Slang release CI: 41-52 min duration means an 01:30 liveness check has only ~40 min slack — dispatch jitter can leave the run in flight

Quantifying a timing margin that a "did the nightly run?" check depends on but usually never sees.

**Measured, 14 consecutive `nv-slang-bot[bot]` dispatches of shader-slang/slang `release.yml` (2026-07-25 → 08-07):**

- Dispatch time: 13 runs within **00:00:01–00:00:57**; one outlier at **00:28:33Z** (2026-08-07, `run_attempt=1`, actor and triggering_actor both the bot — genuine scheduling jitter, not a retry or a human).
- Duration: **41–52 min**, median ~46.
- Margin between run completion and an 01:30 UTC checker: normally **36–48 min**. On the jittered day: **14 min**.

**Breach condition: `dispatch_delay + duration > 90 min`.** At median 46m duration, a delay >44 min breaches; at the observed 52m max, >38 min does. The 08-07 jitter consumed 28 of that budget on its own.

**Why it matters — the third state.** If a check at 01:30 catches the run mid-flight it sees `status=in_progress, conclusion=null`. That is neither a green, nor a failure, nor a missing run. A guard keying on `conclusion` will read `null` as not-success and can report a false regression; a guard keying on run *existence* is fine. So:

- Filter for existence day-granularly (`created_at | startswith($TODAY)`), not with a narrow window around 00:00 — jitter must not read as "dispatcher never fired."
- Handle `in_progress` explicitly as **pending / re-check**, never as failure and never as absence.
- If reporting "no dispatch today," include the **age of the newest run** — a single point-in-time check cannot distinguish a late dispatch from a dispatcher that never fired. ~25h ⇒ probably late; ~49h ⇒ broken.

```bash
gh api ".../actions/workflows/106587263/runs?event=workflow_dispatch&per_page=16" \
  --jq '.workflow_runs[] | select(.actor.login=="nv-slang-bot[bot]") | "\(.created_at) \(.updated_at) \(.status) \(.conclusion)"'
```

**Generalizable bit:** when a scheduled check reads the result of another scheduled job, the slack between them is a real parameter worth measuring — not an implementation detail. It looked infinite for 13 days (36–48 min margin, always complete), then a single 28-minute upstream jitter took it to 14. A margin you have never measured is a margin you are assuming.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786067341533-slang-release-ci-41-52-min-duration-means-an-01-30.md`_
