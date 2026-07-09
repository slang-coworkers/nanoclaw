---
title: "slang#12002: spirv_asm named registers leak into OpName; texture-sample intrinsic uses %sampled"
type: learning
topic: slang-compiler
source: learnings/1783525064110-slang-12002-spirv-asm-named-registers-leak-into-op.md
---

# slang#12002: spirv_asm named registers leak into OpName; texture-sample intrinsic uses %sampled

shader-slang/slang#12002 reported a local var's SPIR-V debug name (`OpName "sampled"`) "misattributed" onto an instruction inside a `[noinline]` callee. **The premise is a coincidence, not a bug — verify it with a rename drill before believing name-migration claims.**

## Root cause (verified @ 33f9ed0ce, source @ bfe6a7f14)
Slang's SPIR-V emitter emits an `OpName` for **every named `%id` register in a `spirv_asm` block**, unconditionally (not gated on debug-info level):
- `slang-emit-spirv.cpp:11591-11592` — `for (const auto& [name,id] : idMap) emitOpName(...DebugNames..., id, name);`
- `idMap` (local `Dictionary<UnownedStringSlice,SpvWord>`) is populated at `slang-emit-spirv.cpp:11203-11211` (`case kIROp_SPIRVAsmOperandId`) from each named register in the block.

The texture-sample intrinsics in `source/slang/hlsl.meta.slang` name their raw-sample register `%sampled` (~20 sites: 1329/1359/1390/1449/1479/2010/2038/2068/2154/2182/2584/... — `%sampled : __sampledType(T) = OpImageSample{Implicit,Explicit}Lod ...`). So **every** texture sample on `-target spirv` emits `OpName <id> "sampled"` on the sample inst inside whatever function did the sample — completely independent of the caller's variable names. The reporter simply happened to name their local `sampled` too.

## The decisive discriminator (do this for ANY "debug name on wrong inst" claim)
Rename the user's variable and recompile. If the disputed `OpName` **follows** the rename → real propagation. If it **stays** → it's an intrinsic-internal / emitter-baked name, and the match was coincidence. Here: rename `sampled`→`myResult` ⇒ callee `OpName "sampled"` unchanged, and the user's `myResult` produced **no OpName at all** (call-result values don't route through `maybeEmitName`). Also confirmed the debug-info side (`DebugLocalVariable`/`DebugValue`) is correctly tied to the `OpFunctionCall` in `main`.

## Fix framing
- Narrow/low-risk: rename the intrinsic register (`%sampled`→`%rawSample`) in hlsl.meta.slang; needs core-module rebuild.
- Principled root fix: don't leak spirv_asm-internal register names as OpName, or gate emission on `getDebugInfoLevel()` — same family as the "-g0 doesn't zero OpName" gap (learning 1782145409789). Wider test churn → maintainer-scope call.

Cosmetic only — OpName is a non-semantic debug decoration; no runtime/codegen impact. GPU-free repro: `slangc -target spirv-asm | grep OpName`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783525064110-slang-12002-spirv-asm-named-registers-leak-into-op.md`_
