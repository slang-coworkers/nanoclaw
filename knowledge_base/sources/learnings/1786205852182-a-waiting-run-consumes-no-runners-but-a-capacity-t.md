# A "waiting" run consumes no runners — but a capacity throttle that counts it livelocks the queue

Found in shader-slang/slang CI, 2026-08-08. Reusable in two directions.

## The bug shape

`extras/ci/ci_priority_common.py:29`:
```python
ACTIVE_STATUSES = {"queued", "in_progress", "waiting", "requested", "pending"}
```
The comment above it says these are statuses that "hold, or are waiting for, runner capacity". The
throttle (`wait-for-priority.py`) makes each bot CI dispatch yield behind any *older* bot run in an
active status.

But GitHub's `waiting` means **parked on a deployment-environment approval gate** — a human. Such a run
consumes **zero** runners. So one run awaiting review converts into a queue-wide livelock: run #30098
sat `waiting` on `environment=falcor-ci` (reviewers `ci-approvers`) for **27h19m** and every later bot
dispatch reported `conclusion=failure` from the yield marker. Blast radius 7❌/1✅/1-null of 9.

The docstring at `wait-for-priority.py:9-10` says "queued or in progress" — **the constant is broader
than its own documented intent**, which is the cheap tell that the extra members were not deliberate.

**Generalizable:** when a status set is meant to model *resource contention*, audit every member against
"does this state actually hold the resource?" Aggregating a human-gated state with machine-queued states
is a category error, and its symptom (a wall of red on unrelated branches) points nowhere near the cause.

## The diagnostic trap that makes it expensive

A healthy yield reports **`conclusion=failure`** on the gating aggregator job — deliberately, so the run
"consumes no expensive build/test runners" (`ci.yml:113-117`). So the load-shedding mechanism is
**indistinguishable from a broken build** at the level of `/actions/runs?status=failure`, which is exactly
what a monitoring precheck polls.

Discriminators that work (all measured, none inferable from the run name):
- **`event`** — the throttle only fires on `workflow_dispatch` + `triggering_actor == nv-slang-bot[bot]`
  (`ci.yml:99-101`). A `merge_group` or `pull_request` red is never this.
- **presence of the `wait-for-human-priority` job**, with ~37 of 40 jobs `skipped` and only that job plus
  the aggregator red.
- the yield **names its blocker in the log**: `Yielding behind earlier bot CI #30098 (workflow_dispatch,
  waiting, by github-actions[bot])` — fetch `/actions/runs/<id>/logs`, don't guess.

⚠️ Matching on *name + repo* is what previously nearly made me clear a human's genuinely-broken PR as
this benign pattern. Record a benign pattern **with its discriminator**, and spend the extra API call on
the *clearing* direction — a fabricated all-clear ships silently where a fabricated alarm gets
investigated.

## Bounded, and say so

`--max-yield-hours 12` releases blocked runs. Proof rather than assumption: run #30105 created 13:23:04Z
had `run_started_at` 01:23:59Z the next day = 13h33m late, then `success`. So the correct report is
"bot CI is ~12h late", not "bot CI is dead" — the ceiling changes the severity and the fix urgency.

## How to check it in one call

`/actions/runs/<id>/pending_deployments` returns the environment, `wait_timer`, and the reviewer team for
a `waiting` run. That single endpoint distinguishes "parked on a human" from "queued for a runner", which
is the distinction the whole bug rests on.
