---
title: "CI babysitter: use canonical memory/rerun-tracker.json path; GPU diagnostic logging is unconditional, not proof of a crash"
type: learning
topic: ci-tooling
source: learnings/1789748229938-ci-babysitter-use-canonical-memory-rerun-tracker-j.md
---

# CI babysitter: use canonical memory/rerun-tracker.json path; GPU diagnostic logging is unconditional, not proof of a crash

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-18T16:17:09.938Z
---

# CI babysitter: use canonical memory/rerun-tracker.json path; GPU diagnostic logging is unconditional, not proof of a crash

**What happened (2026-09-18):** A babysitter session wrote to `/workspace/agent/memory/ci-babysitter/rerun-tracker.json` / `rerun-log.jsonl` instead of the canonical `/workspace/agent/memory/rerun-tracker.json` / `rerun-log.jsonl` that CLAUDE.md actually specifies (bare `memory/`, no subfolder). A separate, concurrently-running babysitter instance was correctly maintaining 3+ days of history in the canonical file on PR #13105, showing `test-linux-debug-gcc-x86_64-rhi/test-slang-rhi` failing deterministically with `VUID-vkCmdBuildAccelerationStructuresKHR-pInfos-10904` — a legitimate regression from the PR's own slang-rhi bump, declined for rerun 4x since 2026-09-15. Because the divergent session never read the canonical file, it misclassified the same failure as a fresh "single-runner flake" and reran it (12:08:38Z), then misread a **second, distinct** failure as another fresh GPU-crash flake and reran again (16:08:05Z).

**Root causes to avoid repeating:**
1. **Always operate on the exact paths CLAUDE.md names** (`memory/rerun-tracker.json`, `memory/rerun-log.jsonl`) — not a subfolder variant, even if one already exists with plausible-looking content. Before classifying any PR, grep/read the canonical tracker+log for that PR number first — do not rely solely on a freshly-created or session-local tracker file, since another concurrent sweep instance may already hold the real history.
2. **A GPU/XID diagnostic-logging step runs unconditionally on failure** (as part of a "collect diagnostics" step), regardless of what actually caused the job to fail. Seeing `nvidia-smi FAILED`, XID errors, or `::error::GPU health check failed` text in a failed job's log is **not sufficient** to classify it as a GPU/infra flake — find the actual failing step/error line (e.g. `##[error]Unable to download artifact(s)`) that precedes it and classify based on that, not the diagnostic noise that follows any failure.
3. **An expired build artifact (`Artifact not found for name: ...`) can never be fixed by `gh run rerun --failed`**, because the job that produced the artifact already succeeded and won't be re-triggered by `--failed`. Any `--failed` rerun of a job in this state is guaranteed to repeat the same artifact-not-found failure — decline, don't rerun, regardless of what diagnostic text surrounds it.
4. **There can be multiple concurrent CI-babysitter sweep instances operating on the same repo** (evidenced by sweeps landing ~every 2h on the canonical tracker from a different process than this session). If you trigger a rerun, another instance may already have declined the identical failure minutes/hours earlier — always check the canonical log's most recent entries for the PR before acting, not just your own session-local state.

Corrected via a `"correction"`-verdict note in the canonical `memory/rerun-tracker.json` (13105 entry) and a matching line appended to `memory/rerun-log.jsonl`; the wasted rerun (attempt 5) was cancelled via `gh run cancel` before it left the queued state.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789748229938-ci-babysitter-use-canonical-memory-rerun-tracker-j.md`_
