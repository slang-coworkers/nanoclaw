---
title: "eval-runner fixer: slang-eval fork gives no CI verdict; runner dies on container restart; spent_usd resets per budget_gen"
type: learning
topic: agent-ops
source: learnings/1792192404849-eval-runner-fixer-slang-eval-fork-gives-no-ci-verd.md
---

# eval-runner fixer: slang-eval fork gives no CI verdict; runner dies on container restart; spent_usd resets per budget_gen

---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792152303717-3mux7x
written_at: 2026-10-16T23:13:24.849Z
---

# eval-runner fixer: slang-eval fork gives no CI verdict; runner dies on container restart; spent_usd resets per budget_gen

Seen on fixer-baseline-20261016 (2026-10-16, bank e565453, eval-slang-fixer, Opus 5.5). 11 trials were dispatched, 0 scored, $246 spent.

- **No CI verdict, by construction.** slang-coworkers/slang-eval has `.github/workflows/ci.yml` and Actions is enabled, but `actions/workflows` lists 0 workflows and `actions/runs` lists 0 runs. Also, ci.yml's `filter` job has `if: github.event.pull_request.draft != true`, and eval_run.py's prompt asks for a DRAFT PR. The only check suites (claude, devin) stay queued with 0 runs. Every fixer trial therefore ends `unknown` (PR found, 900 s grace) or `timeout`. Fix the fork's CI registration and the draft-vs-CI conflict before spending on another fixer job.
- **A timeout without a PR is scored reward 0, not unknown.** This happened to 5 of 11 trials. Three of them opened their PR 40–100 min after the 7200 s timeout. Read pass@k=0 as "no signal", not as "the fixes failed".
- **The runner process does not survive a container restart.** A runner started detached at 12:12Z died at the 15:10Z restart and wrote no job.json. You can resume from run.log plus the trial dirs without re-dispatching: reuse eval_run's EvalJob, re-attach in-flight sessions with `_started = session created_at`, and queue only the trials never dispatched. A script that does this is at eval-compliance reports/evals/fixer-baseline-20261016/resume_run.py.
- **`ncl cost-cap status` spent_usd restarts at each budget_gen.** After the restart it read $1.40 for a session that `ncl cost-cap sessions --group <folder> --sessions` priced at $30.43. For budget enforcement, take max(status, priced).
- **Eval sessions keep running and spending after the runner times out their trial.** Fixer trials cost $12–38 each, so a 240 USD cap fits about 11 trials.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792192404849-eval-runner-fixer-slang-eval-fork-gives-no-ci-verd.md`_
