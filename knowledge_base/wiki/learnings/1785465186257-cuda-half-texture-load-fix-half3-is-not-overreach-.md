---
title: "CUDA half-texture Load fix: half3 is NOT overreach; report count-drift + OUTPUT_REVIEW re-arm pitfalls"
type: learning
topic: review-process
source: learnings/1785465186257-cuda-half-texture-load-fix-half3-is-not-overreach-.md
---

# CUDA half-texture Load fix: half3 is NOT overreach; report count-drift + OUTPUT_REVIEW re-arm pitfalls

From shipping slang#12277 (draft PR #12303) — the `static_assert(!__isHalf<T>())` guard in the cuda case of read-only `_Texture<T>.Load`. Complements the earlier learning "CUDA texture Load half-texel gap" with what surfaced during review:

**half3 must be rejected too — narrowing to widths {1,2,4} REINTRODUCES the bug.** A reviewer (codex) initially flagged that `__isHalf<T>()` firing for `half3` "exceeds the half/half2/half4-only scope." Wrong: `tex*fetch_int<T>` has NO half instantiation for ANY width (prelude only instantiates float/uint/int), so `Texture2D<half3>.Load` on CUDA hits the same NVRTC undefined-template link error. Triage's "half/half2/half4" enumerated the common widths the reporter hit, NOT an allowlist that must let half3 compile. `!__isHalf<T>()` (which the `kIROp_IsHalf` peephole folds true for every half width by unwrapping the vector element) is exactly right. Verified empirically: half/half2/half3/half4/Texture3D<half4> all → E41400; float4/uint4/int4 and RWTexture2D<half4>.Load (surf2Dread path) → clean. Lesson: when a reviewer calls a guard "too broad," check whether the "extra" inputs are actually ALSO broken — rejecting them may be correct, and narrowing would regress.

**Diagnostic-message accuracy is an OUTPUT_REVIEW must-fix surface.** codex OUTPUT_REVIEW blocked on: (a) implying "RWTexture<half...>" works for all widths when the surface `_convert` path only specializes half1/half2/half4 (not half3; docs/cuda-target.md:176) — reword to "Some RWTexture half widths"; (b) quoting a FABRICATED verbatim NVRTC error — paraphrase instead of quoting an error you didn't capture; (c) claiming an issue "tracks" a feature when the maintainer only called it "related" (verify what the referenced issue is actually titled via `gh issue view`).

**Two process pitfalls in the codex-critique delivery gate:**
1. **Side-artifact edits re-arm OUTPUT_REVIEW.** Writing memory/*.md AFTER an OUTPUT approve re-armed the gate ("N edits since last critique"), even though the deliverable was byte-identical. Do memory writes BEFORE the final OUTPUT_REVIEW, or expect one more refresh round.
2. **Report count-drift: pre- vs post-expansion test totals.** I reported "tests/diagnostics/ = 708/708" from an early run, but after adding my 9-entry test the directory is 715/715. Always re-run the count AFTER the test is added; codex verifies numbers against a live run and will block a stale total. Same for `git diff --stat` line counts (I wrote +78, actual +76) — read the stat, don't estimate.

Also: PLAN_REVIEW took 4 rounds here mostly on TEST QUALITY (codex wanted each half width in its own directive + explicit float/uint/int + RWTexture controls, not one loose shared pattern) and comment hygiene (delete section-header comments that restate directives). Building the comprehensive per-width test up front would have saved rounds.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785465186257-cuda-half-texture-load-fix-half3-is-not-overreach-.md`_
