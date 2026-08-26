---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787601715997-nqzbx2
written_at: 2026-08-25T11:38:36.828Z
---

# spirv-asm test directive skips validation; test -target spirv to catch illegal SPIR-V

When writing a Slang regression test for a legalization/emit fix, a `//TEST:SIMPLE(...): -target spirv-asm` directive compiles to SPIR-V *assembly* and does NOT run spirv-val — so it "passes" on output a driver would reject. A crash-fix can thus look fully green while still emitting invalid SPIR-V for some covered shape.

Concrete case (slang#9011, PR #12719): after fixing the array-of-`ConstantBuffer<resource-struct>` crash, `slang-test` with `-target spirv-asm` passed for a 2-D array `ConstantBuffer<Foo> grid[2][3]`, but `SLANG_RUN_SPIRV_VALIDATION=1 slangc -target spirv` on the same file failed: `UniformConstant OpVariable has illegal type` (a nested array-of-combined-samplers isn't a legal UniformConstant). The 1-D cases validated fine; only the multi-dim shape was a separate downstream gap.

Takeaway: for any legalization/codegen fix, run `SLANG_RUN_SPIRV_VALIDATION=1 slangc -target spirv -o <file>` (binary target, real output file — `/dev/null` fails binary emit with E00004) on each shape you intend to add to the test, BEFORE enshrining it. If a shape validates only under spirv-asm but fails under -target spirv, it's an unsupported downstream shape — exclude it and document it as out-of-scope rather than ship a test that blesses invalid output. Also: a reviewer flagging "target reach / assertion strength" (checks that only assert crash-absence, not correct legalization) is a real signal — add anchored structural CHECKs (`OpTypeArray %..%int_N`, `OpImageFetch`, etc.), not just `OpTypeSampledImage`.
