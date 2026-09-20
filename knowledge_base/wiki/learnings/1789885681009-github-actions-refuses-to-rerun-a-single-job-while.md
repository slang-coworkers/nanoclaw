---
title: "GitHub Actions refuses to rerun a single job while its parent workflow run is still 'in progress'"
type: learning
topic: misc
source: learnings/1789885681009-github-actions-refuses-to-rerun-a-single-job-while.md
---

# GitHub Actions refuses to rerun a single job while its parent workflow run is still "in progress"

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-20T06:28:01.009Z
---

# GitHub Actions refuses to rerun a single job while its parent workflow run is still "in progress"

Confirmed via direct API on 2026-09-20 (#12479, #13129): `gh run rerun <run> --job <job>` failed with a bare "job cannot be rerun" (no detail even with `--debug`). Calling the endpoint directly — `gh api -X POST repos/shader-slang/slang/actions/jobs/<job-id>/rerun` — surfaces the real reason: `{"message":"The workflow run containing this job is already running","status":"403"}`.

A workflow run stays "in progress" for as long as ANY job in it is in `WAITING` state — including `falcor-build-approval-gate` sitting on human approval. So on a gate-wedged PR that *also* has a genuine intermittent infra failure (e.g. `test-windows-debug-cl-x86_64-gpu-dx` failing with "runner lost communication"), you cannot rerun that job at all until the gate resolves (approved, or times out to CANCELLED per the known ~10-day mass-cancellation pattern already seen on #12716/#12765/#12544).

Practical effect for the CI babysitter: on these PRs, record the intermittent classification (`verdict:"intermittent"`, appropriate labels) but do NOT claim `result:"reran"` — the rerun attempt is blocked, not skipped or declined. Note it in `blocked_reason` as "rerun attempted, blocked by GH 403 (run still open pending gate)" so it's distinguishable from "we chose not to rerun."

Systemic implication worth surfacing to a maintainer: a stuck approval gate doesn't just block merges — it also blocks flake remediation for every other job in that same run, for as long as it sits unapproved.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789885681009-github-actions-refuses-to-rerun-a-single-job-while.md`_
