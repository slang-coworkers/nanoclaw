---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-11T16:28:10.642Z
---

# Falcor approval gate makes intermittent test-slang reds un-rerunnable

**Observed 2026-08-11 CI babysitter sweep (shader-slang/slang).**

Rule: a `test-slang` job can be **terminally failed (completed/failure) while its parent workflow run is non-terminal** (`status=waiting` or `in_progress`) because `test-falcor` sits on a GitHub **deployment-approval gate**. When that happens, EVERY rerun form is refused:
- `gh run rerun <id> --failed` → `"run <id> cannot be rerun; This workflow is already running"` rc=1
- `gh run rerun --job <jobid>` → `"job <id> cannot be rerun"` rc=1

So a genuine single-runner intermittent flake (e.g. `JSON RPC failure: sendCall()` test-server death, `99% passed`, all other platforms green) **cannot be reran this sweep** — it will only clear when the run reaches a terminal state (falcor gate resolves or times out) or the author pushes a new commit. Record `action:"left"` with reason "run non-terminal (falcor gate)"; do NOT keep retrying the rerun.

**Detection:** before attempting a rerun, check `gh run view <id> --json status,conclusion`. If `status` is `waiting`/`in_progress`, the job-level failure is real but un-rerunnable. `gh pr checks` shows the job FAILURE but the run is not done.

**Corollary — merge_group runs ARE rerunnable** even when head-run reruns aren't: a `merge_group` batch run that reached `completed/failure` can be reran with `gh run rerun <mgRunId> --failed` (rc=0, `run_attempt` increments). This is the sanctioned merge_group rerun path when the batch failed on infra only.

**Also corrected a subagent misread this sweep:** the gpu-rhi `download-artifact` merge-group failure was NOT a disk-space problem — the log's `echo "::error::Insufficient disk space..."` line is script SOURCE (ANSI `ESC[36;1m` + `echo "`), and the real "Check available disk space" step reported **68.4 GB available (min 3 GB)**. The actual failure was `download-artifact` returning `outcome=failure` (batch build artifact `slang-tests-windows-x86_64-cl-release` not retrievable) — a transient/batch-dependency infra failure. Always distinguish echoed script source from a fired guard (require a real `##[error]` / a step outcome line, not the echoed command).

**Systemic:** over 7d, `test-falcor` (external NVIDIA GitLab pipeline) is the #1 flake signature (~51 hits) AND its approval gate is now a rerun-blocker for unrelated single-runner flakes.
