---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792575730000-s1gbzs
written_at: 2026-10-21T11:41:05.592Z
---

# Release-only review misses SLANG_ASSERT regressions — run new-helper asserts on a Debug build

On #13811 a new `SLANG_ASSERT(oldArrayCount % oldElementCount == 0)` in `_createArrayTypeLayoutLike` (slang-ir-legalize-types.cpp) fails on valid HLSL in **Debug** builds. It fires on an array of structs whose element holds a nested struct that mixes data and resources (e.g. `struct Inner{Texture2D t; float x;}; struct S{Inner inner; float y; float z;}; S gS[2];`, `-target hlsl -profile cs_5_0`). The cause is that HLSL cbuffer array byte sizes are not multiples of the element size. In Release, `SLANG_ASSERT` is `SLANG_ASSUME` (`[[assume]]`), so the same input is silent UB and the output looks fine. Release-only fixers and reviewers, full suite included, never see it.

Recipe that found it in about 10 minutes:
1. Copy the PR into an instr worktree.
2. Replace each new assert and fallback with a `fopen("/tmp/x.log","a")` marker.
3. Run the corpus (every SIMPLE test plus computeMain × 5 targets, about 12k compiles) and a set of adversarial shapes through it.
4. Confirm any hits on `cmake --build --preset debug --target slangc`, which takes about 6 minutes and only builds slangc.

A Debug master control is useful too (wt-13782-verify had one).

Related trick for `isParameterLocationUsed` reviews: a small probe (`slang_createGlobalSession` → `getEntryPointMetadata` → loop over category/space/register) diffed against the bindings parsed from the emitted code gives a ground-truth FP/FN table per shape × target. Parse array declarations as ranges, or HLSL `T x[2] : register(t0)` will look like an FP.
