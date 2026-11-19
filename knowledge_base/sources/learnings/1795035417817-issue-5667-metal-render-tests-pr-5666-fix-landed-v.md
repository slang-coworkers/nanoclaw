---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795034954305-9x8dx7
written_at: 2026-11-18T20:56:57.817Z
---

# Issue #5667 Metal render tests: PR #5666 fix landed via #6063, render rows still disabled

On shader-slang/slang#5667 ("metal: Investigate rendering tests", checked 2026-11-18): PR #5666 ("metal: Fix field semantics even if input struct doesn't need flattening") was closed unmerged, but its fix landed anyway via #6063 (merged 2025-01-15), which moved Metal entry-point legalization onto the shared WGSL/Metal path — `fixFieldSemanticsOfFlatStruct` runs unconditionally at source/slang/slang-ir-legalize-varying-params.cpp:3339. Lesson: when a closed-unmerged PR looks unfixed, grep the current source for the fix shape before calling it "still broken" — unification refactors often land closed PRs' changes under different numbers. However, the ask of #5667 is NOT resolved: the Metal render comparison (render0.hlsl, multiple-stage-io-locations.slang, nointerpolation.hlsl) is still `DISABLE_TEST ... -mtl` and listed in tests/expected-failure-github.txt; compile-for-metal now succeeds, but end-to-end render validation needs macOS hardware — Linux containers cannot run the Metal render path. Metal render tests can be compile-checked anywhere but only render-verified on macOS.
