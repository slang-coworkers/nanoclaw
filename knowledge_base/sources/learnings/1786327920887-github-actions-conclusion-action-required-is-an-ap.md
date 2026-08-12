# GitHub Actions conclusion=action_required is an approval GATE, not a failure — bucket it as a fifth state

## The defect

A CI-health sweep that buckets workflow-run `conclusion` four ways — success / failure / untested
(cancelled+skipped) / non-terminal — will map **`action_required` into the failure bucket** if it
lumps it with `failure|timed_out|startup_failure`. That is wrong, and it inflates the red count.

`action_required` means **a required approval was never granted, so the run never started.** On
fork PRs this is the "Approve and run workflows" gate for a first-time / outside contributor.

## Proof at three independent surfaces

Measured 2026-08-10 on shader-slang/slang #11448 (fork `romeoahmed/slang`), run `31317701857`:

1. **Zero jobs ever existed.** `actions/runs/<id>/attempts/1/jobs` → `total_count=0`, and
   `attempts/2/jobs` → HTTP 404. Nothing executed, so there is no log, no step, no signature.
2. **GitHub itself refuses the rerun.** `gh run rerun <id> --repo <r> --failed` prints
   `run <id> cannot be rerun; This workflow run cannot be retried`. ⚠️ **It exits rc=0** — so a
   script that only checks the exit code will record a phantom success for a rerun that never
   happened.
3. **Same sha is green for the non-gated workflows** (`CI SlangPy Trigger Test`, `PR Maintenance`,
   `Claude PR Review` all `success` on that head), so this is not a repo-wide breakage.

## Why it matters

On one sweep this misfiling turned **12 genuinely-red PRs into 23** — 11 of 40 failure rows were
gates (#11448 ×5, #9085 ×4, #12282 ×2). Every one is unrerunnable, so a babysitter acting on them
burns calls that cannot succeed and reports a red count ~2× the truth.

It also fails in the *inaction-biased* direction for the PR author: the fix is a human pressing
"Approve and run workflows", and a bot that files it as "flaky CI, declined to rerun" leaves a
contributor's PR gated indefinitely with no one told the real blocker.

## The rule

Treat `action_required` as a **fifth state — UNSTARTED-GATE** — never as failure and never as
"untested/benign":

```python
if r["status"] != "completed":            bucket = "nonterminal"
elif r["conclusion"] == "success":        bucket = "success"
elif r["conclusion"] == "action_required": bucket = "gate"        # <-- needs a HUMAN, not a rerun
elif r["conclusion"] in ("failure","timed_out","startup_failure"): bucket = "failure"
else:                                     bucket = "untested"     # cancelled|skipped|neutral|stale
```

Cheap confirmation that a red is really a gate: **`attempts/1/jobs` → `total_count == 0`.** A real
failure always has at least one job. Report gates to a human as "awaiting workflow approval",
because that is the only thing that clears them.
