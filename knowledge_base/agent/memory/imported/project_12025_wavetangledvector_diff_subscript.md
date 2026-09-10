---
name: project_12025_wavetangledvector_diff_subscript
description: "#12025 WaveTangledVector diff subscript — CLOSED, maintainer self-fix PR #12026"
metadata: 
  node_type: memory
  type: project
  originSessionId: 11d3e8aa-19b8-41d7-8ace-d79c0ae6bf39
---

CLOSED (07-09) — maintainer self-fix. shader-slang/slang#12025 "Mark WaveTangledVector subscript accessors differentiable". Author kaizhangNV (maintainer), filed UNASSIGNED.

**Resolution:** yield condition tripped — kaizhangNV opened non-draft PR **#12026** (branch fix/wavetangled-vector-differentiable-subscript, `Fixes #12025`, ~35s after the issue → fix was ready at filing). Bot stood down, no competing PR. Triager verified against live GitHub, refreshed triage comment issuecomment-4927843341 in place ("confirmed bug → resolved by author PR #12026"), set Issue Type=Bug. PR = full Approach A; the IVector-refinement unknown resolved by author's approach. Maintainer-owned review (not our surface). Re-dispatch ONLY if #12026 abandoned AND a maintainer asks us to take over.

--- original triage (retained for context) ---
Author kaizhangNV (maintainer), filed UNASSIGNED with concrete plan.

**Bug (confirmed at HEAD a97110a43):** `WaveTangledVector.__subscript` get/set lack `[Differentiable]` (accelerate-vector-coopmat.slang:93-100) while `InlineVector`'s have them (inline-vector.slang:71-80). `IVector` inherits a NON-differentiable subscript from internal `IArrayAccessor` (vectorized-reader.slang:22-26). So `fwd_diff`/`bwd_diff` can't synthesize derivatives through WaveTangledVector element access.

**Approach A (author's full proposal, recommended):** mark both accessors `[Differentiable]` + add `[Differentiable]` subscript requirement to `IVector` + shared generic contract test (both types, fwd+bwd, -vk/-cuda).

**Load-bearing unknown:** whether `IVector` can cleanly refine/override the non-differentiable subscript req inherited from `IArrayAccessor`. Fixer to build-verify; if it can't be done cleanly, report the constraint — accessor-marking + regression test stand alone.

**State:** triager → slang-fixer (triager owns fixer edge; I did NOT double-dispatch). DRAFT PR only, merge operator-gated. Triage 5-bullet posted (issuecomment-4927843341); no `reproduced` label (needs GPU+cooperative_matrix). Files: source/standard-modules/neural/{accelerate-vector-coopmat, inline-vector, ivector, vectorized-reader}.slang.

**Yield condition:** if kaizhangNV self-assigns/comments self-own intent before draft lands → PARK, stand fixer down. Canonical thread gh-issue-shader-slang/slang-12025. Await fixer's PR-open report or IVector-refinement blocker.
