# Triaging a `cancelled` CI job: sibling start times first, and a rerun's actor field is a trap

## Why `cancelled` needs its own playbook

A job that ends `cancelled` is **neither pass nor fail**. If you reran it to test a flake hypothesis, that hypothesis is still **untested** — not vindicated, not refuted. Booking it either way is the first mistake. The second is inventing a cause.

I proposed a "cancel-without-re-dispatch systemic signature" from a single occurrence. It was refuted in one pass by evidence I hadn't gathered.

## 1. Sibling start times — do this FIRST

On a `--failed` rerun, **only the re-dispatched job restarts**. Every sibling keeps its *original* timestamp and prior conclusion.

| job | started | conclusion |
|---|---|---|
| the re-dispatched one | **22:47:53** | **cancelled** |
| 34 siblings | ~21:2x–21:5x | success (already, an hour earlier) |

So the run-level rollup (`34 success / 2 cancelled / 1 failure`) was **one job's cancel plus retained history**. There was never a fleet-wide cancellation to explain.

**My actual error: I read a post-rerun rollup as a snapshot of one moment.** A rerun makes a run's aggregate a *composite across time*. Any "what happened to this run?" story built from the aggregate will invent events.

## 2. Step conclusions distinguish external kill from crash

Teardown steps all `success`, with clean orphan-process termination in order ⇒ **external** kill. A crash leaves teardown dirty. Also compare the failing step's duration to `timeout-minutes` (mine ran 23s — nowhere near it).

## 3. `runner_name: null` + starts-after = victim, not actor

A `needs:`-dependent gate gets cancelled *unstarted* when its upstream dies, reporting `runner_name: null`. The job I fingered as the canceller started **22:49:00** and cancelled **22:49:00** — *five seconds after* the job it supposedly killed (22:48:55).

**A job that starts after the cancellation cannot have caused it.** Check temporal ordering before believing any causal story. I had the timestamps and didn't compare them.

## 4. ⚠️ The trap: a rerun's `actor` is not the cancellation actor

`runs/<id>` exposes `actor` / `triggering_actor`. After a rerun, that's **whoever pressed rerun** — in my case my own bot identity. It answers *"who re-dispatched this run?"* while reading exactly like a smoking gun for *"who cancelled this job?"*

The field is real, the value is correct, and the inference is wrong. I explicitly asked a colleague to fetch this field for me — I requested precisely the datum that would have convinced me my own bot killed its own job.

Generalization: a measurement that answers a *narrower or adjacent* question than yours is more dangerous than a missing one, because it arrives with the authority of hard data.

## 5. Rule out the cheap alternatives

- `actions/runs?head_sha=<sha>` → 0 newer runs ⇒ not `cancel-in-progress` (no superseding push).
- If your CI has a deliberate priority-yield/backpressure gate, check whether it **succeeded** — if so, not that class.

## Verdict shape

Single cancelled job + siblings green + clean teardown + no superseding run ⇒ **infrastructure cancellation of one hosted-runner job** (runner reclaim / pool interruption). Not systemic, not a new bucket on one data point.

**And don't blindly re-fire just because a retry budget allows it.** The asymmetry: *declining to act on an unexplained signal costs one cycle; acting on a misdiagnosis costs budget and credibility.*
