---
name: project_12098_memoize_val_substitutions
description: "#12098 Memoize Val substitutions — TERMINAL: WOULD_APPROVE CLEAN → closed-unmerged, superseded by merged #12106; human=CHANGES_REQUESTED (soft false-safe)"
metadata: 
  node_type: memory
  type: project
  originSessionId: beec622e-c4f3-4c39-a535-9a330dda5be0
---

shader-slang/slang **#12098 "Memoize Val substitutions"** — author saipraveenb25 (maintainer's own PR). Val-substitution memoization cache (compiler perf/correctness).

**Verdict (2026-07-14):** slang-pr-approver → **WOULD_APPROVE (CLEAN)** @ 999b90eb, mode=live, policy v0-shadow-relaxed. Primary tier (production claude-code-action, pinned head, not stale) = 🟡 0 bugs / 5 gaps → APPROVE_WITH_NITS. All 6 eligibility clauses pass; challenger cleared all 5 gaps as advisory (test-coverage / unstated-invariant, no real trigger). Independently verified the one correctness-adjacent finding (ModifiedType `*ioDiff=1` clobber, slang-ast-type.cpp:2194) is boolean-safe vs cache's `+= delta`. Devin timed out (124) — primary tier authoritative, reviewers_complete=true.

**Shadow mode → ledger-only, no GitHub write.** Maintainer merges it themselves — no action item for me.

**Calibration watch** (only matters if a human requests changes): gap #4 = stack-cache-pointer escape via SubstExpr; plus the release-mode validateContext assert (SLANG_ASSERT no-op). See [[feedback_approver_never_posts_route_reviewer]].

**TERMINAL (2026-07-28) — human-verdict join.** PR **closed-unmerged @ the decision SHA 999b90eb** by the author ("Fixed by a different PR: #12106"). Human reviews: csyonghe ×2 **COMMENTED** (no formal CHANGES_REQUESTED; reviewDecision=REVIEW_REQUIRED). Successor **#12106 merged by csyonghe** — re-architected to "one source of truth: the environment-local cache", discarding #12098's transient `SubstitutionSet::substitutionCache` pointer design. `record_human_verdict=CHANGES_REQUESTED`. Scored as a **soft FALSE-SAFE** (superseded by author's own better design, no shipped defect) — NOT rounded to agreement. **Challenger-miss / training signal:** the challenger cleared exactly gap #4 (transient stack-cache-pointer escape/lifetime via `SubstitutionSet::substitutionCache`) as "undemonstrated future-proofing" — but that is the wiring csyonghe probed live ("field appears never initialized — how is this supposed to work?") and the merged successor removed the design entirely. Lesson: a design/representation gap (transient mutable pointer on an interned value type) must not be cleared just because no test trips it — a green harness ≠ a principled representation; interning-safety ≠ design-soundness. Learning `[approver/false-safe]` filed.
