---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786057199918-c59tss
written_at: 2026-08-11T09:20:49.067Z
---

# Slang CI priority-yield: a stale yielded run is NOT terminal — the gate escalates on any rerun, only the retry helper's 16h lookback expires

## TL;DR

An aged-out `nv-slang-bot` CI priority-yield in shader-slang/slang is reclaimable by **one manual full rerun**, at any age, regardless of contention. What expires at 16 h is only the *automatic* retry helper. Do not report a stale yield as "permanently red, ready-flip is the only path" — that conflates two independent mechanisms.

## The two mechanisms (read the source, not the conclusion)

Both at master `1ca1aa50e5`:

1. **The gate** — `extras/ci/wait-for-priority.py:176-190`, invoked from `ci.yml` with `--max-yield-hours 12`. Age comes from `run_age_hours()` reading **`created_at`, which is fixed across reruns** (only `run_started_at` / `run_attempt` change — the docstring says so explicitly). Past the ceiling it sets `yielded = False` and proceeds **despite** higher-priority CI. So age *helps* you here: the older the run, the more certainly it escalates.
2. **The retry helper** — `ci-retry-yielded-bot.yml` → `retry-yielded-bot-ci.py:135`, `--lookback-hours 16`, drops any candidate with `created_at < now-16h`, and refuses entirely while any `ci.yml` run is active (`CI is still active (N run(s)); not rerunning`). This is the part that expires.

⇒ **"No automatic rerun" and "no rerun possible" are different claims.** A run at 108.6 h is invisible to (2) forever, yet would sail through (1) on a manual `POST /repos/{owner}/{repo}/actions/runs/{id}/rerun`. The helper reruns *fully*, not `--failed`, so the ~33 skipped build/test jobs re-evaluate rather than staying skipped.

## The measurement that settles it

Run `31182372649` (`fix/issue-11981`), `run_attempt=2`, `triggering_actor=nv-slang-bot[bot]` — so `IS_THROTTLED_BOT=true` and the throttle branch really was live. Age at rerun exactly **12.0 h**. Decision line:

```
Priority gate for run #30105 (id=31182372649, age 12.0h) on shader-slang/slang workflow ci.yml.
Waited 12.0h (>= 12.0h ceiling); escalating priority and proceeding despite higher-priority CI.
  would have yielded to #30139 (pull_request, in_progress, by zangold-nv)
  would have yielded to #30132 (pull_request, in_progress, by jkwak-work)
```

Result: **36 success of 37 jobs** with two active human runs it *would* have yielded to. That is the escalation path firing under contention — the exact case a "contention-gated, so terminal" story predicts cannot happen.

## Three instrument traps hit while measuring this

- **`gh api .../jobs/{id}/logs` without `--allow-escape-sequences` returns a 99-byte advisory message**, not the log ("the response contains terminal escape sequences; pass ..."). Piped into `grep`, that is a silent zero that reads as "no decision line logged." Control it with a byte count, and cross-check the **step conclusion** (`Stop yielded bot CI: skipped` ⇒ `yielded=false`).
- **Two mechanisms, one similar outcome.** Sibling `31179559787` also reached attempt 2 and built (32/37) — but its `triggering_actor` is `github-actions[bot]`, which *fails* `IS_THROTTLED_BOT` and **bypasses the gate entirely** rather than escalating. Citing it as evidence for escalation would be a wrong-mechanism attribution. Check `triggering_actor` before using any rerun as evidence about the gate.
- **A run's `conclusion` cannot tell you what the gate decided** — the helper's own conclusion is `success` even when it did nothing. Read the decision line or the step conclusions.

## How to apply

Before reporting any yielded run as stuck:
1. `run_attempt` + `created_at` age, and whether age ≥ 12 h (gate ceiling) — if yes, a rerun escalates.
2. Whether `created_at < now-16h` — if yes, only the *automatic* helper is out; say so precisely.
3. Distinguish "no automatic path" (often true) from "no path" (usually false).
4. Remember **build CI ≠ full coverage**: a green rerun still doesn't compile a `.cu` fixture that no workflow step references.
