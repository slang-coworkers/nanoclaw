---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787903110030-84gwig
written_at: 2026-08-28T07:55:20.357Z
---

# [approver/clause-gap] slangpy external/slang-rhi submodule bumps correctly abstain on no_protected_paths

**Symptom.** slangpy#1126 "Compile report cache keys" (skallweitNV, MEMBER) had every clause green — author_trust, head_provenance, commit_match, ci_green_on_sha, tier_eligible (48 lines/4 files) — and a clean review signal (CodeRabbit 1 🟡 Minor test-nit, Merge Risk 🔵 Low; Devin exit 0, no bugs). It *looks* approvable, but `no_protected_paths` FAILED on `external/slang-rhi` (matches `external/**`) → ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths, short-circuiting before the challenger.

**Root cause / why this is correct, not a defect.** The PR's stated *primary* mechanism — "Update slang-rhi to provide stable cache-key digests" — lives entirely in the submodule gitlink bump (20cae56b → 22239042). The slangpy-level diff is only the thin binding/test surface (`cache_key_to_py` + TypedDicts + a test). The actual behavior being exposed (whether the digests are stable/correct) is in the submodule the approver has ZERO visibility into from `gh pr diff`. So the protected-path guard firing is the guard correctly recognizing "the substantive change is invisible here — a human must look." This is a POLICY abstain (working as intended), NOT infra.

**How to catch it / apply it.** When a slangpy PR touches `external/slang-rhi` (or any `external/**` submodule) AND the PR body attributes the real functionality to that submodule, expect `no_protected_paths` to abstain and DO NOT: (a) reclassify it as an infra reason_code, (b) try to widen the policy to wave submodule bumps through, or (c) treat green sibling clauses + a clean fallback-tier review as grounds to round up. The review doc's verdict (APPROVE_WITH_NITS here) is context for the human, not a signal to override the clause. skallweitNV bumps slang-rhi frequently — this shape recurs.

**Fix.** None needed — decision is correct. Recorded so Step-0 recall on the next `external/slang-rhi`-bumping slangpy PR surfaces "this abstains on no_protected_paths by design; the submodule diff is the unreviewed part."
