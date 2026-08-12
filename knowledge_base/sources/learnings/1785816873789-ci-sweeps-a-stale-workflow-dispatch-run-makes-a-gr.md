# CI sweeps: a stale workflow_dispatch run makes a GREEN PR look red (verify run event before rerunning)

## The trap

`GET /repos/<o>/<r>/commits/<sha>/check-runs?filter=latest` returns the latest run **per check-suite** — and a single PR head can carry **two CI suites at the same sha**: one from `pull_request`, one from `workflow_dispatch`. `filter=latest` does not prefer the newer suite; it emits both. A stale *failed* `workflow_dispatch` suite therefore stays in your red list permanently, even when a **later `pull_request` CI run at the identical sha is fully green**.

## Why it's worse than an ordinary stale red

The failure signature can be entirely **real**. On shader-slang/slang #12186 (2026-08-04) I pulled the Falcor job log and found a correctly-identified, known-tracked flake signature (`renderpasses/test_GBufferRTTexGrads_d3d12` FAILED, `Mogwai.exe exited with return code 3221225477` = 0xC0000005), with the usual discriminator holding. I was one step from `gh run rerun --failed`. That run (`30858600527`) was `event=workflow_dispatch, run_attempt=2`; the `pull_request` run at the same head (`30860511719`) was **36 success / 1 skipped, `test-falcor` and `check-ci` both success**. The head was already green.

**Signature validity does not establish that the run is the live verdict.** Classification ("is this failure a flake?") and currency ("is this run still the answer?") are independent checks — passing the first tells you nothing about the second. Same failure family as `gh pr checks` phantom-green and `--paginate` truncation: the instrument silently answers a narrower question than the one you asked.

Second instance the same sweep: #12208's red `build-linux-debug-gcc-x86_64` was a 07-24 `workflow_dispatch` suite (logs since 410-expired), while `pull_request` run `30066220779` at the identical sha had that job **and** `check-ci` green. 2 of 29 red PRs affected.

## Recipe — before ANY rerun

```bash
gh api "repos/<o>/<r>/actions/runs/<run-id>" --jq '{event, conclusion, run_attempt, head_sha}'
# if event != pull_request, enumerate every CI run at that sha:
full=$(gh api repos/<o>/<r>/pulls/<N> --jq .head.sha)
gh api "repos/<o>/<r>/actions/runs?head_sha=$full&per_page=50" \
  --jq '.workflow_runs[] | select(.name=="CI") | "\(.event)\t\(.conclusion)\t\(.created_at)\trun=\(.id)"'
```

A `pull_request:success` at the same sha ⇒ head is green, **do not rerun**. Cheap whole-sweep detector: print the `event:conclusion` list per red PR — `pull_request:success workflow_dispatch:failure` is the tell.

## Who is most exposed

Bot-authored PRs, because retry/priority-yield workflows re-dispatch CI via `workflow_dispatch`. That's the same population as the known "lone red `workflow_dispatch` with every build/test job SKIPPED is a no-op" case — this is the harder variant, where the dispatch suite really ran, really failed, and still isn't the verdict.

**Judge head health from the `pull_request` run or the check rollup, never from a `workflow_dispatch` run alone.**
