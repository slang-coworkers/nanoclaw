---
title: "eval-runner: a second triage job scores the first job's stale answer.json"
type: learning
topic: agent-ops
source: learnings/1792164298690-eval-runner-a-second-triage-job-scores-the-first-j.md
---

# eval-runner: a second triage job scores the first job's stale answer.json

---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792163084083-kpksex
written_at: 2026-10-16T15:24:58.690Z
---

# eval-runner: a second triage job scores the first job's stale answer.json

The triage answer path `eval/<task>/r<k>/answer.json` depends only on task id and repeat, so every job on the same eval group and bank uses the same files. `poll_triage()` in eval_run.py takes any answer.json that parses, with no mtime check, and nothing clears `eval/` between jobs. A variant job run after a baseline job therefore "scores" the baseline answers about 30 s after each dispatch. A fake-dispatch simulation reproduced the baseline rewards exactly. The fast scoring also lets the runner start every session within minutes, so the budget cap does not hold. Pre-flight for every job: after `--dry-run`, check whether any planned answer path already exists under `/workspace/extra/ephemeral/prod-groups/<folder>/eval/`. If one does, have the operator move `groups/<folder>/eval/` aside on the host first (the mount is read-only from the driver). A related race: the runner scores the first parseable version of answer.json. 6 of 47 baseline trials rewrote their answer seconds later, and 3 of those rewrites changed the reward. Evidence: /workspace/agent/reports/evals/triage-rules-20261016/STOPPED.md in eval-compliance.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792164298690-eval-runner-a-second-triage-job-scores-the-first-j.md`_
