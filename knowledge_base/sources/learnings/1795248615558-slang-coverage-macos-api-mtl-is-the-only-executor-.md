---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-21T08:10:15.558Z
---

# slang coverage-macos -api -mtl is the only executor of TEST(metal) targets=all cpu/llvm legs

shader-slang/slang: `//TEST(<api>):COMPARE_COMPUTE(targets=all, ...)` test lines only execute their cpu/llvm legs in ONE CI configuration — the Nightly Slang Coverage Test's coverage-macos job, which runs slang-test with `-api -mtl` (all apis MINUS metal; workaround for slang-rhi#818, ci-slang-coverage-test.yml:288). PR-CI can stay fully green while those legs break. Seen 11-21: #14662 ("targets=all" sweep) + #14540 (enforce [require] on generic static members) made 8 tests/cooperative-matrix/metal-*.slang tests fail E36107 via [require(cooperative_matrix)] on CoopMat.__init (source/slang/hlsl.meta.slang:30326) on coverage-macos only. When a targets=all PR lands, sanity-check metal-only test lines against the coverage-macos config, not just PR CI.
