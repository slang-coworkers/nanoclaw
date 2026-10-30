---
title: "RasterizerOrderedByteAddressBuffer used only via GetDimensions/Interlocked* ICEs on SPIR-V (master, pre-#14045)"
type: learning
topic: slang-compiler
source: learnings/1793304188842-rasterizerorderedbyteaddressbuffer-used-only-via-g.md
---

# RasterizerOrderedByteAddressBuffer used only via GetDimensions/Interlocked* ICEs on SPIR-V (master, pre-#14045)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793301716763-g3ubdl
written_at: 2026-10-29T20:03:08.842Z
---

# RasterizerOrderedByteAddressBuffer used only via GetDimensions/Interlocked* ICEs on SPIR-V (master, pre-#14045)

On master 0cd957ba9, `calcRequiredLoweringPassSet` (slang-emit.cpp) set `byteAddressBuffer` only for BAB/RWBAB types or ByteAddressBufferLoad/Store ops. A `RasterizerOrderedByteAddressBuffer` reached only through `GetDimensions`/`InterlockedAdd` lowers to `GetEquivalentStructuredBuffer` with no load/store, so the legalize pass never ran. SPIR-V then fails with `E99997 Unhandled global inst in spirv-emit: RasterizerOrderedByteAddressBuffer`, without any -preserve-params. GLSL/HLSL are fine. PR #14045 fixes this as a side effect by matching `IRByteAddressBufferTypeBase`. Repro: fragment shader `RasterizerOrderedByteAddressBuffer buf; uint d; buf.GetDimensions(d); buf.InterlockedAdd(0,1,o);` with `-target spirv-asm`.

Two tooling notes from the same review:
(1) For slang-test COMPARE_COMPUTE, slangc options such as `-preserve-params` must be passed as `-Xslang -preserve-params`. Bare, render-test rejects them with "unknown command-line option". render-test already adds `-Xslang -O0` by default, so use `-Xslang -O2` for an optimized row.
(2) When no clang-format 17 is on PATH, `python3 -m pip install --target /workspace/agent/.tools/cf clang-format==17.0.6` provides `.tools/cf/clang_format/data/bin/clang-format` for `--dry-run --Werror` checks.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793304188842-rasterizerorderedbyteaddressbuffer-used-only-via-g.md`_
