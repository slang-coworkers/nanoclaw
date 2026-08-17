---
title: "[approver/human-agreement] downstream test-fix that unblocks a prior shadow-BLOCK — verify diff-line vs break site, then WOULD_APPROVE"
type: learning
topic: review-approval
source: learnings/1784282766770-approver-human-agreement-downstream-test-fix-that-.md
---

# [approver/human-agreement] downstream test-fix that unblocks a prior shadow-BLOCK — verify diff-line vs break site, then WOULD_APPROVE

**Symptom / scenario:** A tiny slang-rhi (or any downstream-repo) PR lands that "looks like" the fix for a break your earlier core-PR shadow-BLOCK identified. Orchestrator flags the correlation but says "verify, don't assume."

**Case:** slang-rhi#799 @fc1e0e25 — WOULD_APPROVE (CLEAN), MERGED at decided head (1afb8384), human COLLABORATOR skallweitNV APPROVED the exact SHA ⇒ agreement. It is the downstream fix for my #12141 shadow-BLOCK (core PR disabling `vector<T,4>` `(vec2,T)`/`(T,vec2)` init via `static_assert(false)`, which turned `test-ray-tracing-clusters.slang:74` `float4(attribs.barycentrics,1.f)` into E41400).

**How to confirm the unblock (don't assume from the title):**
1. Fetch the actual diff and check the changed line number against the break site named in the prior BLOCK's next-action. Here: hunk `@@ -71,+3` = old-line 74 = the exact `:74` site.
2. Read the downstream tracking issue (slang-rhi#798) — it was filed "while addressing" the core design issue (#12093) and carried a byte-identical proposed diff. That closes the loop that this is THE fix, not a coincidence.
3. Verify semantic equivalence of the fix, not just that it compiles: `float4(float2, 1.f)` compiled via scalar→vector *splat* (1.f→float2(1,1)) resolving `__init(vec2 xy, vec2 zw)` ⇒ `(x,y,1,1)` — NOT the legacy 0/1/2/3-element tail-pad ⇒ `(x,y,1,0)`. The fix `float4(float2, 1.f, 1.f)` resolves `__init(vec2 xy, T z, T w)` ⇒ same `(x,y,1,1)`. Author chose `1.f,1.f` (not `1.f,0.f`) deliberately to preserve CURRENT compiled behavior — right call for a test. (Prior learning 1784281175141 pre-verified this splat-vs-tail-pad nuance against core.meta.slang:2796/:2784.)

**Fix / calibration:** The downstream fix is safe to merge STANDALONE (the 4-arg form is valid against current Slang — CI proves it), so WOULD_APPROVE it on its own merits. In the report, state the cross-repo landing order explicitly: downstream test-fix merges → slang submodule bump → the blocked core PR's CI goes green. It should land first (or alongside). Do NOT gate the downstream PR on the core PR — that inverts the dependency.

**False-safe guard (still applies):** this is a #12141-family PR (a class where a prior sibling missed a CI break), so wait for every affected CI leg to settle green before recording anything approving. slang-rhi build legs with `flags:unit-test` run `slang-rhi-tests` incl. the OptiX `ray-tracing*.cuda` steps that exercise this shader; build-only legs (aarch64 gcc/clang, emscripten, windows aarch64 Debug) only compile. Green on both proves compile + test.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784282766770-approver-human-agreement-downstream-test-fix-that-.md`_
