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

**TERMINAL — MERGED 2026-07-18T16:10 by jkwak-work** (COLLABORATOR maintainer, not author) at `6b66fb1af24e` = the R2 decision commit, **both 🔴s unfixed** (no commits after R2). `human_verdict=APPROVED` recorded on R2 row. **Safe-direction disagreement** (approver BLOCKed, human merged) — NOT a false-safe; no bug waved through. BLOCK vindicated: the R2 PRIMARY review that timed out during the decision window posted ~2h later (10:41Z) and confirmed both 🔴s verbatim (null-blob assert; unbounded recursion framed as "DoS on untrusted source"); byte-identical fallback reasoning matched head-current PRIMARY exactly. jkwak re-APPROVED 13:07Z *after* the 🔴 review was visible, then merged — both bugs low real-world severity (Bug 1 example/demo not shipping lib; Bug 2 DoS reachable only on adversarial deep nesting, outside reflection-API trusted-source threat model). Approver lesson captured (`[approver/human-disagreement]`): annotate the severity axis (example/test/doc-only or untrusted-input-only) so a safe-direction disagreement reads as expected without softening the shadow BLOCK.

--- history ---
**Verdict: BLOCK (RED_BUG) — twice.** Shadow mode, nothing posted to GitHub.
- **R1 @ `0feba4d397e2`** (2026-07-16, superseded): PRIMARY production review (github-actions[bot]) = 2 bugs / 2 gaps / 2 clarity; both 🔴 source-verified, codex-attested.
- **R2 @ `6b66fb1af24e`** (2026-07-18, current): synchronize was a **pure master-merge** — both flagged files byte-identical R1→R2 (git blob sha match), PR diff vs merge-base unchanged (1471/36/15). Neither 🔴 addressed. Full fresh procedure re-run (R1 did NOT carry forward; distinct ledger row). PRIMARY review check-run timed out (runner backlog, queued 23+min) → fell to Devin fallback tier; no false-safe risk since code byte-identical to R1's reviewed head, both 🔴s re-verified directly. Devin R2 also flagged an *additional* wasm behavior-split bug (`slang-wasm.cpp:607`).

Both 🔴 (present verbatim at both heads):
1. `examples/reflection-api/main.cpp:236-238` — asserts blob non-null && size==4 after `SLANG_SUCCEEDED(getDefaultValueBlob())`, but API contract allows null blob (no initializer → SLANG_OK) and non-4-byte defaults → assert aborts on documented-valid success. **Ordinary trigger — carries the BLOCK.** PR-introduced (in scope).
2. `source/slang/slang-reflection-api.cpp:4033` — recursive default-value serializer has 16MB output cap + enum-alias depth cap but **no recursion-depth bound** on nested struct/array/inheritance → stack overflow. Exotic, corroborates.

**Open loop:** human jkwak-work APPROVED 2026-07-13; both 🔴s postdate the approval. Procedure does NOT round a source-verified 🔴 up to a stale human approval. Approver records human verdict on the merge/close join — merges as-is = human-disagreement to examine; author pushes a real fix = BLOCK vindicated. Author must fix example success-case handling + add recursion-depth guard.

Calibration lessons (approver → shared learnings): (R1) first harvest hit slang#12064 STALE-only timing race, exit 10; re-harvest recovered head-current PRIMARY — don't stop at first harvest. (R2) stuck-PRIMARY fallback discipline; a master-merge synchronize fixes nothing — verify blob sha before assuming a push is a fix. See [[feedback_approver_never_posts_route_reviewer]].
