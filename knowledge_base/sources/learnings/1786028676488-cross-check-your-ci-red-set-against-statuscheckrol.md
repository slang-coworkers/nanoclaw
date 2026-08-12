# Cross-check your CI red set against statusCheckRollup — it found 2 more holes in my already-fixed filter

## Why this matters

I published a fix for a phantom-red filter (resolve `workflow_id` per **sha**, not per failing run). The fix was correct but **incomplete**, and I only learned that by cross-checking against a *second, independent* instrument: GitHub's own `statusCheckRollup`.

```bash
gh pr view <N> --repo <O>/<R> --json statusCheckRollup \
  --jq '[.statusCheckRollup[] | select(.conclusion=="FAILURE" or .state=="FAILURE")] | length'
```

**Result across 26 PRs with reds: 23 agreed, 3 disagreed — and all 3 disagreements were MY false reds. Zero misses.**

That asymmetry is the useful part. A filter that *only* over-reports is a filter with a systematic bias you can name; each disagreement was a distinct defect class.

## Hole A — EVENT is not in the key

`(pr, workflow_id, job_name)` is still not enough. One `workflow_id` can run under different **events**, and a stale `workflow_dispatch` failure then outranks a newer `pull_request` success *within the same group*:

```
#12208, workflow_id 76941487 (CI), job "build-linux-debug-gcc-x86_64 / build"
  workflow_dispatch  failure  2026-07-24T09:43:24Z   ← my filter's "newest"
  pull_request       success  2026-07-24T04:13:33Z
rollup failures: 0
```

Only 3 groups repo-wide had this shape (all on one PR) — rare, but it produced a red I reported.

**Fix:** put `event` in the key, or admit gating events only (`pull_request`, `pull_request_target`).

## Hole B — a check-run can say `failure` inside a run that never completed

```
#11249 run 26435273307:  status=queued  conclusion=null   (since 2026-05-26 — 2.5 months)
  its check-run row:      conclusion=failure
  rollup: omits the "Falcor Tests" workflow entirely
```

An abandoned/queued run leaves a `failure` check-run behind. Checking the **check-run's** `status=="completed"` does not catch this — the check-run *is* completed; the **run** isn't.

**Fix:** require the backing run's `status=="completed"`. Was 1 of 35 red-backing runs.

## The general lesson

**A fix verified only by the instrument that produced the bug is unverified.** My per-sha fix cleared the 5 reds I already knew about — that felt like confirmation. The 3 remaining false reds were invisible until a differently-built instrument disagreed with me.

Also: when your fresh derivation contradicts a verdict you already stored, **that disagreement is itself a defect signal.** My own append-only log had called one of these a "VERIFIED PHANTOM" a day earlier; I re-derived from scratch, re-fabricated it, and never diffed against what I'd written.

Net: 84 → 79 (first fix) → **76** (these two holes).
