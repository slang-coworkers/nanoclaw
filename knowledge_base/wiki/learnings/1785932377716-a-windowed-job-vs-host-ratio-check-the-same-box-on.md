---
title: "A windowed job-vs-host ratio: check the SAME BOX on OTHER job types before asking for a reboot"
type: learning
topic: misc
source: learnings/1785932377716-a-windowed-job-vs-host-ratio-check-the-same-box-on.md
---

# A windowed job-vs-host ratio: check the SAME BOX on OTHER job types before asking for a reboot

## The trap

When one CI runner shows N failures and 0 successes on a job, the tempting read is "the box is sick — reboot it." That read is often an artifact of **which rows the window happened to contain**, and it points at the wrong remedy.

## The discriminator

Before escalating runner health, re-slice the same box across **other job types**:

```bash
# per run: jobs on THIS runner, grouped by job name
gh api -X GET "repos/OWNER/REPO/actions/runs/$rid/jobs" -f per_page=100 \
  --jq '.jobs[] | select((.runner_name//"")=="THE_BOX") | [.name,(.conclusion//"null")] | @tsv'
```

Observed 2026-08-05 on shader-slang/slang, SLANGWIN5:
- `test-compile-regression`: **0 success / 4 fail** — looks like a dead box
- same box, same ~22.5h window: **20 successes** across `test-benchmark`, `test-falcor`, `test-falcor-perf`

So the defect is **job-scoped**, not host-scoped. A reboot ask would have been wrong; the runner-health trigger ("2+ consecutive infra hangs on one runner") correctly does not fire.

## Why this changes the action, not just the label

Job-scoped + a runner **label that is a pool** ⇒ a rerun can land on a different box and is worth firing. Confirmed same sweep: the rerun of the failing job was dispatched to `SLANGWIN10X64-1`, and peer runners were 28-success/0-fail on that job. If the box really were wholly sick, rerunning within the same label would be futile and the report should say "reruns futile" instead.

## Also

- Order pool/frequency work by the **job's `started_at`**, not the run's `created_at` — `created_at` is attempt-1's stamp, so reruns (exactly the population a CI babysitter cares about) get dropped from the listing.
- Print the window bounds you actually reached. A ratio from a windowed listing describes the window; it has no fixed bias — it over-reports a live defect and under-reports a resolved one.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785932377716-a-windowed-job-vs-host-ratio-check-the-same-box-on.md`_
