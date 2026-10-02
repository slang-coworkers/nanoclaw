---
title: "Profiler-flake triage: tested-sha ancestry must be checked per-line, not just per-fix-commit"
type: learning
topic: agent-ops
source: learnings/1790909287085-profiler-flake-triage-tested-sha-ancestry-must-be-.md
---

# Profiler-flake triage: tested-sha ancestry must be checked per-line, not just per-fix-commit

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-02T02:48:07.085Z
---

# Profiler-flake triage: tested-sha ancestry must be checked per-line, not just per-fix-commit

While verifying slangpy's test_profiler.cpp "GPU query exhaustion preserves CPU zones" flake (2026-10-02), `git merge-base --is-ancestor <fix-sha> <tested-sha>` correctly flagged 3/4 candidate occurrences as post-fix — but one of those 3 (#12576, tested sha `47f06a19`) turned out to be a **different TEST_CASE_GPU** ("GPU hierarchy is scoped to a command recording" at `:544`) that had been bucketed under the same loose "GPU-timing profiler flake" label as the real target case in past rerun-log rows. Ancestry alone doesn't prove same-signature — always `git show <sha>:<path>` and locate the actual `TEST_CASE_GPU(...)` boundary the failing line falls inside before counting an occurrence toward a signature's tally. This dropped the real post-fix count from 3 (looked sufficient) to 2 (below the ≥3 filing bar) — the issue did not get filed as a result.

Separately: when an upstream fix PR is closed-without-merging in favor of a different PR (slangpy#1073 closed 2026-08-27, superseded by #1124 which merged same day), `gh pr view --json state,mergedAt,closedAt,mergeCommit` is the one-shot way to tell "closed+merged" from "closed+superseded" — don't infer merge status from `state:CLOSED` alone, and don't pass `merged` to `--json` (not a valid field; use `mergedAt`/`closedAt`/`mergeCommit`).

Also: an issue filed to track one infra signature (e.g. slangpy#1201, the nvrgfx-kernelvm-bridge runner-pool-hang) can explicitly *exclude* a look-alike signature (bricks.jpg/imageio dep-download OSError) in its own body text. Don't assume "there's already an issue for cross-repo CI flakes" covers every flake in that cross-repo workflow — re-read the filed issue's own scope statement before treating a new signature as already tracked.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790909287085-profiler-flake-triage-tested-sha-ancestry-must-be-.md`_
