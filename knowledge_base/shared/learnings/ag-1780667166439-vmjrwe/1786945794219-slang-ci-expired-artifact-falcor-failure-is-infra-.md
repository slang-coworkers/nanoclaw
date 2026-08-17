---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378839902-60ah7d
written_at: 2026-08-17T05:49:54.219Z
---

# Slang CI: expired-artifact Falcor failure is infra, and `gh run rerun --failed` can't fix it (re-runs the consumer, not the producer)

## TL;DR
A `test-falcor` (external NVIDIA GitLab bridge) failure on a slang PR can have a purely-infra cause
that is NOT the change under review and that a plain rerun will **not** clear. Read the job log
before treating it as a code failure or assuming a rerun helps.

Measured on shader-slang/slang#12479 (2026-08-15), head `56cb7604d0`:
- `ci.yml` run: **38/41 jobs success**, 1 skipped; only `test-falcor / Test (Falcor)` + its
  `check-ci` aggregator failed. Every Slang build+test job (incl. the Windows-cl-release ones)
  **passed**.
- The Falcor step log said: `run-external-ci: Slang artifact
  'slang-tests-windows-x86_64-cl-release' ... is unavailable (expired, still building, or the token
  cannot see it); not triggering Falcor`. So Falcor never ran shaders — it couldn't fetch the
  upstream Slang test artifact.
- `gh api .../runs/<id>/artifacts` confirmed: `slang-tests-windows-x86_64-cl-release`
  **`expired=true`** (122 MB), while the build job that produced it had `conclusion=success`. The
  artifact simply aged past retention before the self-hosted Falcor runner (`kernelvm`) pulled it.

## The rerun trap
`gh run rerun <id> --failed` re-runs **only the failed jobs** — here just the Falcor consumer — **not
the successful build job that produces the artifact.** So on an *expired-artifact* failure the rerun
re-fetches the same expired artifact and fails again. Verified: after `--failed`, the running set was
`["test-falcor / Test (Falcor)"]` and the build job was NOT re-running.
- A rerun DOES help for a *transient* external failure (the pipeline flaked) — which is a different
  Falcor failure mode (that one's log shows the pipeline actually ran and `finished with status
  'failed'`). Distinguish the two by reading the step log: "is unavailable / not triggering" = expired
  artifact (rerun futile); "pipeline NNN finished with status 'failed'" = ran-and-failed (rerun may help).
- What actually regenerates the artifact: a **fresh full CI run** — a new push, or the maintainer
  flipping ready / rebasing. Do NOT push a no-op commit just to refresh CI on a PR already awaiting
  review; report it as infra and let the artifact owner / shepherd decide if a green Falcor gates merge.

## How to apply
1. On a `github.ci_failed` webhook, list failed jobs (`gh run view <id> --json jobs`). If only
   `test-falcor` + `check-ci`, and all Slang build/test jobs are green, it's almost certainly not the code.
2. Read the Falcor step log to classify: expired-artifact vs ran-and-failed vs genuinely-your-change.
3. Expired-artifact ⇒ infra; a `--failed` rerun is likely futile; escalate to the Falcor-bridge owner
   rather than churning commits.
4. Also check `mergeStateStatus`: `BEHIND` means master moved (rebase is a maintainer call, not the bot's).
