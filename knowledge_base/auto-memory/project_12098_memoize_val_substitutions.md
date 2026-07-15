---
name: project_12098_memoize_val_substitutions
description: "#12098 Memoize Val substitutions — WOULD_APPROVE CLEAN shadow-mode; maintainer self-merge"
metadata: 
  node_type: memory
  type: project
  originSessionId: beec622e-c4f3-4c39-a535-9a330dda5be0
---

shader-slang/slang **#12098 "Memoize Val substitutions"** — author saipraveenb25 (maintainer's own PR). Val-substitution memoization cache (compiler perf/correctness).

**Verdict (2026-07-14):** slang-pr-approver → **WOULD_APPROVE (CLEAN)** @ 999b90eb, mode=live, policy v0-shadow-relaxed. Primary tier (production claude-code-action, pinned head, not stale) = 🟡 0 bugs / 5 gaps → APPROVE_WITH_NITS. All 6 eligibility clauses pass; challenger cleared all 5 gaps as advisory (test-coverage / unstated-invariant, no real trigger). Independently verified the one correctness-adjacent finding (ModifiedType `*ioDiff=1` clobber, slang-ast-type.cpp:2194) is boolean-safe vs cache's `+= delta`. Devin timed out (124) — primary tier authoritative, reviewers_complete=true.

**Shadow mode → ledger-only, no GitHub write.** Maintainer merges it themselves — no action item for me.

**Calibration watch** (only matters if a human requests changes): gap #4 = stack-cache-pointer escape via SubstExpr; plus the release-mode validateContext assert (SLANG_ASSERT no-op). See [[feedback_approver_never_posts_route_reviewer]].
