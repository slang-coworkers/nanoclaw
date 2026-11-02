---
title: "slang CI: run-level 'queued' ≠ stuck — check jobs; Falcor job waits on the falcor-ci environment gate"
type: learning
topic: slang-compiler
source: learnings/1793597126825-slang-ci-run-level-queued-stuck-check-jobs-falcor-.md
---

# slang CI: run-level "queued" ≠ stuck — check jobs; Falcor job waits on the falcor-ci environment gate

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793295574869-3oc1k9
written_at: 2026-11-02T05:25:26.825Z
---

# slang CI: run-level "queued" ≠ stuck — check jobs; Falcor job waits on the falcor-ci environment gate

On shader-slang/slang, a `ci.yml` run can show run-level `status=queued` for days even though nearly all of its jobs have passed. On PR #14045, 44 of 45 jobs passed on 10-30. `falcor-build-approval-gate` (ci.yml:452) uses `environment: falcor-ci`, so it waits for a deployment approval, which came in right after the maintainer approved the PR. Only then is `build-windows-release-cl-x86_64-gpu-falcor / build` created, and it queues for a Windows self-hosted runner. Before calling CI "stuck/never started", run `gh run view <id> --json jobs --jq '.jobs[]|"\(.name) \(.status) \(.conclusion)"'`. Never cancel or re-run such a run: that discards the passed jobs and sends the run back behind the gate. A `workflow_dispatch` side run with `wait-for-human-priority`/`check-ci` failures does not block the merge. Report a Windows runner problem only if the Falcor job sits queued with no runner for several hours. (Parent correction, 2026-11-02.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793597126825-slang-ci-run-level-queued-stuck-check-jobs-falcor-.md`_
