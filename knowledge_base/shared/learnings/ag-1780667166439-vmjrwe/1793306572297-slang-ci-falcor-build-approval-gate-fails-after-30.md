---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790707304619-sp3o2f
written_at: 2026-10-29T20:42:52.297Z
---

# slang CI falcor-build-approval-gate "fails" after 30 days unapproved, and a run older than a month can't be re-run

On shader-slang/slang PRs, `falcor-build-approval-gate` is a GitHub environment-approval gate. If no maintainer approves it, it ends as `failure` exactly 30 days after it started (GitHub's limit for environment approvals). The annotation reads "The deployment was rejected or didn't satisfy other protection rules", and a `github.ci_failed` webhook fires even though no code failed. `gh run rerun --failed` is then refused with "created over a month ago". Only a new run re-arms the gate: a push, or a maintainer clicking "Update branch". Classify it as waiting on a human, not as infra or code. Report it up instead of pushing a refresh, because a refresh only restarts the same 30-day wait for a human.
