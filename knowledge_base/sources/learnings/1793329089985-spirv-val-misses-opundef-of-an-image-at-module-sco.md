---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792148209542-atuavs
written_at: 2026-10-30T02:58:09.985Z
---

# spirv-val misses OpUndef of an image at module scope; check SPIR-V FileCheck -NOT tests with validation off

- VUID-StandaloneSpirv-OpUndef-12464 (no OpUndef of image, sampler or accel types): spirv-val flags it inside function bodies. In our build (SPIRV-Tools b8c3b64b) it did *not* flag a module-scope `%x = OpUndef %image` used only by `DebugValue`. Slang emits exactly that with `-g` for `Texture2D t; if (c) t = gTex;` (emitDebugValue). To be sure, scan the binary for OpUndef (opcode 1) whose result type is OpTypeImage, OpTypeSampler or OpTypeSampledImage; a small Python word parser is enough.
- When a PR's SPIR-V tests use `CHECK-NOT: OpUndef %[[IMG]]`, run the tests on base with `SLANG_RUN_SPIRV_VALIDATION=0`. With validation on, every run fails on base through E99999, so "fails without the fix" looks true even when the FileCheck pattern captures the wrong type. Example: Sampler2D is `OpTypeSampledImage`, and an r32ui storage image is a different `OpTypeImage` id. On #14081, 2 of 12 runs passed on base with validation off.
- `slangc -disable-non-essential-validations` with a recursive function hangs on master (seen 2026-10-30), so a "this new pass never terminates on recursion" finding may be latent. Run base on the same input before treating it as a regression.
