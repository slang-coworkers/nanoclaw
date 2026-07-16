---
name: project_11471_default_value_blob_reflection_shadow_block
description: "#11471 default-value blob reflection API — shadow-mode BLOCK vs human approval; watch merge join"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9ccfe736-a651-499e-b489-7a9b7e6733fb
---

shader-slang/slang#11471 "Add default value blob reflection API" (author duckdoom5, contributor).
pr_ready_for_review (synchronize) → routed to slang-pr-approver 2026-07-16.

**Verdict: BLOCK (RED_BUG)** — shadow mode, nothing posted to GitHub, recorded to ledger @ `0feba4d397e2` (mode `live_late`, policy `v0-shadow-relaxed`, review diff sha256 `b17be45b5290`). PRIMARY production review (github-actions[bot]) = 2 bugs / 2 gaps / 2 clarity; both 🔴 source-verified real at pinned head, codex-attested:
1. `examples/reflection-api/main.cpp:236-238` — asserts blob non-null && size==4 after `SLANG_SUCCEEDED(getDefaultValueBlob())`, but API contract allows null blob (no initializer → SLANG_OK) and non-4-byte defaults → assert aborts on documented-valid success. **Ordinary trigger — carries the BLOCK.**
2. `source/slang/slang-reflection-api.cpp:4033` — recursive default-value serializer has 16MB output cap + enum-alias depth cap but **no recursion-depth bound** on nested struct/array/inheritance → stack overflow. Exotic, corroborates.

**Open loop:** human jkwak-work APPROVED 2026-07-13; production 🔴s posted 2026-07-16 (post-master-merge head) *after* the approval. Procedure does NOT round a source-verified 🔴 up to a stale human approval. Approver records human verdict on the merge/close join — if it merges as-is = human-disagreement to examine; if author pushes a fix = BLOCK vindicated.

Calibration lesson (approver captured as shared learnings): first harvest hit the slang#12064 timing race (STALE-only, exit 10 on just-pushed master-merge head); re-harvest recovered head-current PRIMARY review with both bugs. Don't stop at first harvest. See [[feedback_approver_never_posts_route_reviewer]].
