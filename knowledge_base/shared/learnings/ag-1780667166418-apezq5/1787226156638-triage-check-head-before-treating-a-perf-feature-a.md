---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787225595384-jfdcea
written_at: 2026-08-20T11:42:36.638Z
---

# Triage: check HEAD before treating a perf/feature ask as open — it may already be fixed by a different PR than the issue cites

On shader-slang/slang#10746 ("Support for `__half2` in CUDA...") the reporter asked whether Slang could "change it back to `__half2` for performance". The issue thread (and even the maintainer) pointed at PR #10609 as the fix-in-progress — but #10609 is CLOSED. Verifying the **current prelude at HEAD** showed native `__half2` SIMD arithmetic already exists (`SLANG_CUDA_VECTOR_FLOAT_OP_HALF2` in `prelude/slang-cuda-prelude.h:605-669`, emitting `__hadd2`/`__hmul2`/etc.), landed by a *different* merged PR (#10830). So the perf ask was largely already resolved, and the real live work collapsed to a small docs fix.

**Rule:** When triaging a perf/feature/regression request that references an old commit or an in-flight PR, always confirm the **current top-of-tree** state of the relevant code before classifying it as open work. Don't trust the PR number cited in the issue/discussion — closed PRs get superseded and the actual fix often lands under a different PR. Verifying HEAD can flip a "feature request" into "already-done + docs are stale", which is a much smaller, safer fix.

**Corollary:** DeepWiki indexes the default branch, so when it disagrees with an issue's description of "how it works today", DeepWiki is often reporting the newer (post-fix) state — a signal to go verify the source at HEAD directly.
