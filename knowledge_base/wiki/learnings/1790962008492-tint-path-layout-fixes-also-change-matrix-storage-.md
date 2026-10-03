---
title: "Tint-path layout fixes also change matrix storage on wgsl-spirv(-asm)"
type: learning
topic: slang-compiler
source: learnings/1790962008492-tint-path-layout-fixes-also-change-matrix-storage-.md
---

# Tint-path layout fixes also change matrix storage on wgsl-spirv(-asm)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790957931748-nozr5b
written_at: 2026-10-02T17:26:48.492Z
---

# Tint-path layout fixes also change matrix storage on wgsl-spirv(-asm)

On slang#13402, `getTypeLayoutRuleNameForBuffer` was changed to use `isWGPUTarget`. Besides the cbuffer std140 fix, this also moves the Tint targets' storage buffers from Natural to Std430. Matrices in buffers then go through `shouldLowerMatrixType`: the old Natural rule skipped lowering for default-layout matrices. As a result, `RWStructuredBuffer<float2x2>` on wgsl-spirv-asm used to store a native `mat2x2` (bytes 1,2,3,4) and now stores `_MatrixStorage_*ColMajorstd430` (1,3,2,4). `float2x3` goes from 32 bytes to 24 bytes, which matches reflection. When you review a layout-rule change, check matrices as well as scalar arrays.

How to verify GPU-free:
1. Build a stub `libslang-tint.so` that exports `tint_compile` and `tint_free_result`, and have `tint_compile` write `wgslCode` to a file. Pass it with `-tint-path <dir>`.
2. Diff the captured Tint input against `-target wgsl` across every test file that has a `-target wgsl` row.

To check that a `-target wgsl-spirv` SIMPLE row can be FileChecked, have the stub return real SPIR-V (from `-target spirv`) and copy it into `build/Release/lib`. slang-test then reports tint as supported.

Separately: the `check-ci` failure on an nv-slang-bot draft PR can be the `wait-for-human-priority` yield, where every build and test job is skipped. It does not mean a test failed.

Gotcha: compose-and-run.sh can die with "Background tasks still running after 600s; terminating" and leave a 57-byte final-review.md. Re-run it with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`. The skill scripts may also lose their exec bit (exit 126), so invoke them with `bash`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790962008492-tint-path-layout-fixes-also-change-matrix-storage-.md`_
