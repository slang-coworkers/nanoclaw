---
title: "ConstantBuffer via spvDescriptorHeapEXT SIGSEGVs in SPIR-V emit (slang#11483)"
type: learning
topic: slang-compiler
source: learnings/1780643259838-constantbuffer-via-spvdescriptorheapext-sigsegvs-i.md
---

# ConstantBuffer via spvDescriptorHeapEXT SIGSEGVs in SPIR-V emit (slang#11483)

## Finding (slang#11483, verified on HEAD b305a4df4 / 2026.9.1-71-g5377f3e02)

A `ConstantBuffer<T>` dereferenced through the descriptor-heap untyped-pointer path
(`getDescriptorFromHandle(ConstantBuffer<T>.Handle(uint2(i,0)))` under `-capability spvDescriptorHeapEXT`)
**hard-crashes the compiler with SIGSEGV during SPIR-V emission** — even for a scalar member access.
An identical `StructuredBuffer<T>` heap access compiles cleanly (exit 0). So the crash is
**ConstantBuffer/uniform-buffer-descriptor specific**, and happens in emission (all IR passes complete).
`-capability spvDescriptorHeapEXT` ALONE triggers it; scalar-layout / `-spirv-resource-heap-stride` are not required.

Minimal repro:
```slang
struct Data { float v; float4x4 m[2]; }
uniform RWStructuredBuffer<float> outBuf;
[vk::push_constant] uint idx;
[numthreads(1,1,1)][shader("compute")]
void computeMain() { outBuf[0] = getDescriptorFromHandle(ConstantBuffer<Data>.Handle(uint2(idx,0))).v; }
```
`slangc min.slang -target spirv-asm -stage compute -entry computeMain -capability spvDescriptorHeapEXT -skip-spirv-validation` → exit 139.

Root area: `emitDescriptorHeapLoad` (source/slang/slang-emit-spirv.cpp:7110-7155) + the member access chain
off the `OpBufferPointerEXT` result for a uniform-buffer descriptor. Storage-class divergence
(`getDescriptorHeapBufferStorageClass` ~7001-7020: StorageBuffer on SPIR-V 1.4+ vs Uniform for a bound CB)
makes the `_natural` element type lower/decorate under a separate cache entry. Prior crash on the same
`.Handle` path: #11037 → "fixed" by PR #11211 (jkwak-work, 2026-05-19); the new crash means that fix is
incomplete or later-regressed. Cross-ref #10265 (ArrayStrideIdEXT not used on the heap path) for the
array-of-matrix wrong-offset variant.

## Triage methodology takeaway
A bug reported as a "GPU runtime returns wrong data" can often be localized **GPU-free**: reproduce the
emit-time crash (or diff `OpDecorate ArrayStride` / `OpMemberDecorate ... MatrixStride|Offset` between the
broken and working code paths via `slangc -target spirv-asm`). Here the GPU-free pass found a *more severe*
crash than the user's reported symptom. Also: always confirm a subagent's crash repro against the
**from-source** `build/Release/bin/slangc` (HEAD), not a packaged `build/slang-<ver>/bin/slangc` — they can differ.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780643259838-constantbuffer-via-spvdescriptorheapext-sigsegvs-i.md`_
