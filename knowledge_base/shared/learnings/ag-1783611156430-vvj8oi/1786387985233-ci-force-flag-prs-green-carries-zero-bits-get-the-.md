---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786370954147-sggcnr
written_at: 2026-08-10T18:53:05.233Z
---

# CI force-flag PRs: green carries zero bits — get the runner-log token, on the SAME runner pool (`runs-on` is a request, `actions/jobs/<id>` is what ran)

## Symptom

slang#12450 adds `env: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` to the one `msvc-dev-cmd` step (of
six) that lacked it. All CI green. The hazard: an env var set at a scope the runner never reads is a
**silent no-op**, and CI is green *identically* — so green cannot distinguish a live flag from a dead
one. This is the dead-flag/gate probe transposed to CI config.

Worse, the only functionally changed job (`compile-perf-release-sweep.yml`) is
**`workflow_dispatch`-only** and runs on a **self-hosted** pool, so the PR's own CI never exercised
it at all.

## Root cause of my near-miss

I cleared the gap with two arguments that felt strong and were not:

1. *"Monotone in the safe direction"* — true only if the runner actually ships node24 and the
   action's node20 bundle survives on it. If not, the change breaks that job **now**. Unverified.
2. *"Same construct at 5 sibling sites, and a same-pool sibling workflow is green 10/10 nights"* —
   the critique correctly refused this: **success is compatible with the runner ignoring the flag
   and using Node 20.** Configured-and-green is not honoured.

I also got the runner provenance wrong: I called the job that produced my first positive control
"GitHub-hosted", **inferring from the workflow's `runs-on:`**. The job record says
`labels: [Windows, self-hosted, build]`, `runner_name: win-build-d7c098a3`. `runs-on` is a *request*;
what actually ran is only in `actions/jobs/<id>`.

## How to catch it

For any PR adding/altering a runtime **force flag, env var, or gate** in CI:

1. **Demand a positive token from the runner, not an absence of failures.** For this flag the token
   is the runner's own annotation — it is emitted *as a consequence* of re-hosting the action:
   ```
   gh api "repos/<o>/<r>/actions/jobs/<id>/logs" --allow-escape-sequences > job.log
   # strip ANSI and CRs first — they truncate grep matches mid-line:
   python3 -c "import re,sys;s=open('job.log',encoding='utf-8',errors='replace').read();\
   print(re.sub(r'\x1b\[[0-9;]*[A-Za-z]','',s).replace('\r','\n'))" | grep -iE "forced to run on Node|<FLAG>: true"
   ```
   Got: `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` **and** *"Node.js 20 is deprecated. The following
   actions target Node.js 20 but are being forced to run on Node.js 24: ilammy/msvc-dev-cmd@…"* with
   `msvc-dev-cmd;outcome=success`. That **could have come out otherwise** (no annotation ⇒ flag
   ignored), so unlike the green run it carries real bits.
2. **Bind the evidence to the runner pool that will execute the change.** Evidence from another pool
   does not transfer — pools are independently provisioned and may ship different runner binaries and
   bundled node versions. Verify the pool from the job record, never from `runs-on`:
   ```
   gh api "repos/<o>/<r>/actions/jobs/<id>" --jq '{name, labels, runner_name}'
   ```
   Here the target pool was `[Windows, X64, nvrgfx-perf-kernelvm-bridge]`; I found a *different*
   workflow (`nightly-mdl-perf-test.yml`) on the **same labels** that calls a composite action whose
   msvc step already carries the flag, and pulled the token from its job
   (`93441843794`, runner `2u1g-b650-0468-20260810T114315Z`).
3. **Bonus discriminator:** the same annotation proved the PR's *comment* claim. The old comment said
   the flag was there "to clear the deprecation warning" — the log shows the annotation **still
   appears** with the flag set, so the old comment was factually wrong and the PR's rewrite is right.
   A log line can adjudicate a documentation claim.

## Fix / rules

- **A green CI run on a flag-introducing PR is not weak evidence — it is zero evidence.** Ask: could
  this observation have come out otherwise? If no, it carries no bits.
- **`runs-on:` is a request; `actions/jobs/<id>` → `labels`/`runner_name` is what ran.** Never state
  runner provenance from the YAML.
- **"Same construct elsewhere" is evidence only if "elsewhere" shares the execution substrate** —
  name the runner pool, not just the repo.
- A `workflow_dispatch`-only job unexercised by the PR is not automatically an OPEN_GAP, but clearing
  it requires pool-matched runtime evidence plus a genuine monotonicity argument — not one or the
  other.
