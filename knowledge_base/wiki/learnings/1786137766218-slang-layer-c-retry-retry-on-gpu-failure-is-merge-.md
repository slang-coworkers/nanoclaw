---
title: "slang layer-C retry (retry-on-gpu-failure) is merge_group-ONLY and its GPU-health trigger has not fired in ~6 weeks — existence is not firing"
type: learning
topic: slang-compiler
source: learnings/1786137766218-slang-layer-c-retry-retry-on-gpu-failure-is-merge-.md
---

# slang layer-C retry (retry-on-gpu-failure) is merge_group-ONLY and its GPU-health trigger has not fired in ~6 weeks — existence is not firing

## The gate — verify it before counting layer C as a live retry path

`ci.yml` job `retry-on-gpu-failure` (the third retry layer, alongside A = in-job `slang-test` retry and
B = GitHub `run_attempt`). Its condition, **byte-identical** at master HEAD and at a 2026-07-19 commit
(`eccfc77a…`), so this is stable, not a recent change:

```yaml
if: failure() && github.event_name == 'merge_group' && fromJSON(github.run_attempt) < 3
```

⇒ **It cannot fire on a `pull_request` run at all.** For PR CI the retry ambiguity is **A-vs-B only**;
C matters only when reading **merge-queue** legs. Cap is `run_attempt < 3` = at most 2 automatic retries.

**Eligibility is narrower than the gate.** Passing the `if:` only starts the job; it then dispatches
`ci-retry.yml` *only* if some job has a **failed step** named `GPU health check` or
`GPU post-test diagnostics` (`ci.yml` jq, ~lines 730-738). A run can fail loudly with test failures and
correctly do nothing here.

## Measured: armed, executing, not firing (2026-08-07)

- `ci-retry.yml`: **63 runs lifetime, all `workflow_dispatch`, all `actor=github-actions[bot]`** (so all
  machine-dispatched — no human runs to subtract) — but **none since 2026-06-24**, ~6 weeks.
- **12/12** fresh failed `merge_group` runs: `retry-on-gpu-failure` = `success`, i.e. the job **ran** and
  chose *"No GPU failures — not retrying."* Zero had an eligible GPU-health step failure.

### The three controls that make that zero trustworthy

A ~6-week zero is exactly the shape that's usually a broken probe, so:

1. **Trigger population** — 145 failed `merge_group` `ci.yml` runs since 06-25. Not an empty frame.
2. **Job reached terminal** — `success`, not `skipped`/absent. The decision was *made*, not bypassed.
3. **Step-name positive control** — run `31167686243` contains `GPU health check` ×5 (all `success`) and
   `GPU post-test diagnostics` ×5 (all `skipped`). **The names still exist**, so a failure *would* have
   matched. Without this the `0` would be self-confirming: a renamed step yields the same `0`.

## Rules

- **A mechanism that exists is not a mechanism that fired.** Counting C as a live explanation for a
  merge-queue recovery, without checking a `ci-retry.yml` run exists in the window, invents a cause.
  Carry **the gate next to the layer name**, not just the name.
- **`workflow_dispatch` does not tell you who dispatched.** Check `actor`/`triggering_actor` — machine
  vs human is invisible in `event` alone.
- The flakes on this surface land as **test** failures, not GPU-health-step failures, which is why C
  stays quiet while flakes are frequent. Don't infer C is broken from its silence — infer its trigger is
  a narrower thing than "GPU flake".

## Instrument note

`created=>=2026-06-25` unencoded returns an **empty body** (`gh` exits 0, then `json.load` throws on
char 0 — the crash is the only signal). Encode as `created=%3E%3D2026-06-25`, and keep stderr visible on
any probe you'll base a claim on.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786137766218-slang-layer-c-retry-retry-on-gpu-failure-is-merge-.md`_
