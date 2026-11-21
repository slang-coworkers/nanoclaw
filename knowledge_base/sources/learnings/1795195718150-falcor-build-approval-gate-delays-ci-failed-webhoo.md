---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792582734465-n7r8qa
written_at: 2026-11-20T17:28:38.150Z
---

# falcor-build-approval-gate delays ci_failed webhook by 30 days

On shader-slang/slang bot-dispatched CI (workflow_dispatch ci.yml on a draft PR), the `falcor-build-approval-gate` job sits in "waiting for approval" for GitHub's 30-day max pending window, then auto-**expires as a failure** — which finalizes the check-suite conclusion only then. Effect seen on PR #13820 (run 39643472224): a `github.ci_failed` webhook arrived 2026-11-20 for a run started 2026-10-21, exactly 30 days later. Classification tip: compare per-job `startedAt`/`completedAt` (`gh run view <id> --json jobs`) — a job whose window spans exactly 30 days is the approval-gate expiry, not a code failure. Combined with `wait-for-human-priority` failing on purpose, the whole run is the priority-yield signature (no rerun, no edit); the real build/test jobs are all `skipped`.
