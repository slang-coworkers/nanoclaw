---
title: "Metal wraps entry-point uniform params (incl pointers) in cbuffer; SPIR-V routes them to push constants"
type: learning
topic: slang-compiler
source: learnings/1784653655393-metal-wraps-entry-point-uniform-params-incl-pointe.md
---

# Metal wraps entry-point uniform params (incl pointers) in cbuffer; SPIR-V routes them to push constants

**Issue shader-slang/slang#10675** ([Metal] unnecessary indirection with pointer arguments). Verified @HEAD 6a244fee2 by source read + repro (Metal is textual emit, no GPU needed).

## The behavior
On Metal, entry-point `uniform` parameters — **including a `uniform T* args` pointer** — get folded into a synthesized struct `EntryPointParams` that is passed as ONE `constant*` `[[buffer(0)]]`. So a pointer param is dereferenced through the wrapper: `entryPointParams_0->args_0->...` (an extra hop the user didn't write). On SPIR-V the same `uniform T*` goes into a **push constant** with no wrapper struct — so "pointer in ⇒ pointer out" holds there but not on Metal.

## Where the divergence lives (both verified by direct read)
1. `source/slang/slang-parameter-binding.cpp:3420-3464` — entry-point params start on `getEntryPointParameterRules()` (:3425). ONLY `if (isKhronosTarget(...))` (:3428) swaps raster/compute stages onto `getPushConstantBufferRules()` (:3449-3451) [ray-tracing → shader-record rules]. **Metal is not Khronos → no swap → the aggregate stays a constant-buffer parameter *group*.**
2. `source/slang/slang-ir-entry-point-uniforms.cpp:264-266` — `needConstantBuffer = as<IRParameterGroupTypeLayout>(entryPointParamsLayout->getTypeLayout()) != nullptr;`. Because of (1), for Metal this is **true**, so `CollectEntryPointUniformParams` wraps every uniform param (pointers included) into the `EntryPointParams` struct (fields added :329-351).
3. Downstream `moveEntryPointUniformParamsToGlobalScope` + `introduceExplicitGlobalContext` pack the globals into the emitted `constant*` `[[buffer(N)]]`; Metal buffer indices are **positional**.

## Existing test that pins it
`tests/metal/entry-point-uniform-vertex-struct-output.slang:61-63` — same `uniform GridCfg* cfg`, asserts Metal `buffer(` vs SPIR-V `PushConstant`. Any change to Metal wrapping must revisit this + sibling metal pointer/uniform tests (metal-pointer-params, metal-pointer-uniform, pointer-in-buffer-*, pointer-no-lowering-local).

## Triage takeaway
Two fix shapes: (A) give a `uniform T*` its own Metal buffer index (pointer-scoped, mirrors the SPIR-V push-constant path, smaller) or (B) stop wrapping Metal entry-point uniforms in an implicit cbuffer generally (cleaner end state, but "quite a bit of fall-out" per the maintainer — every consumer assuming the wrapper must be audited). **Both are breaking** (host-side buffer binding layout shifts) → likely a future-year-release staging decision. This one was maintainer-assigned + Dev Reviewed + a self-described "nice to have" → PARKED for the assignee, no bot PR.

## Method note
SPIR-V *runtime* emit isn't runnable in the sandbox (glslang/spirv-opt downstream `.so` won't load) — that's an ENV limitation, not a design signal. The SPIR-V-vs-Metal contrast is established from the code path + the existing test, and the design claim doesn't need the runtime.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784653655393-metal-wraps-entry-point-uniform-params-incl-pointe.md`_
