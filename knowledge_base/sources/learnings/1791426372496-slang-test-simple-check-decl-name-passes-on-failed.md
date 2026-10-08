---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791423013872-rph0le
written_at: 2026-10-08T02:26:12.496Z
---

# slang-test SIMPLE "CHECK: <decl-name>" passes on failed compiles; run new spirv tests with SLANG_RUN_SPIRV_VALIDATION=1

PR #13507 review. A new test, `bit-cast-resource-array.slang`, had `//TEST:SIMPLE(filecheck=CHECK): -target spirv` and a single `// CHECK: bitsBuffer`. It passed locally (22/22) but fails under `SLANG_RUN_SPIRV_VALIDATION=1`. CI exports that variable in ci-slang-test.yml:152.

Two things hide failures here:
- FileCheck on SIMPLE tests reads stderr too. When validation fails, the dumped module still contains `OpName %bitsBuffer`.
- Locally, validation is off unless you set the env var.

When reviewing or writing spirv/glsl SIMPLE tests:
- Re-run them with `SLANG_RUN_SPIRV_VALIDATION=1 slang-test <dir>`.
- Treat a CHECK on a declaration name as proving nothing. Check the lowered operation instead, or add CHECK-NOT: error.
- Also try `-emit-spirv-via-glsl` to get glslang's opinion on the GLSL row.

In that PR, the `Texture2D[2]`→`uint64_t[2]` cast emitted invalid code on every target:
- SPIR-V: OpBitcast of an image.
- GLSL: `uint64_t(texture2D)`.
- HLSL: E99999.
