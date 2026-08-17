---
title: "slang#8002 __constref ParameterBlock/opaque ICE — copied address-only value escapes global-only legalization"
type: learning
topic: slang-compiler
source: learnings/1784754145569-slang-8002-constref-parameterblock-opaque-ice-copi.md
---

# slang#8002 __constref ParameterBlock/opaque ICE — copied address-only value escapes global-only legalization

## slang#8002 — `__constref ParameterBlock<T>` (and any opaque/resource/non-copyable type) ICEs on SPIR-V & GLSL

**Symptom (verified @ HEAD d384b77e6):** passing a global `ParameterBlock<Data>` to a `int fetch(__constref ParameterBlock<Data> d, ...)` param →
- SPIR-V: `E99997 ... unimplemented: Unhandled global inst in spirv-emit: ... ParameterBlock(...)`
- GLSL: `E99999: unhandled type`
HLSL/Metal/CUDA emit the same repro fine — ICE is SPIR-V/GLSL-legalize/emit-specific.

**Root cause chain (all three layers verified via `-dump-ir` + code trace):**
1. `__constref` → `ParamPassingMode::BorrowIn`. In `addArg` (slang-lower-to-ir.cpp ~3503–3556), a global ParameterBlock arg is `LoweredValInfo::simple(IRGlobalParam)`; `tryGetAddress(...,Default)` returns *Simple* not *Ptr*, so the pass-address fast path is skipped and it **creates a temp `IRVar` and `assign`-copies** the block into it (there's a `TODO(tfoley)` right there about copying non-copyable types). IR: `%49:Ptr(ParameterBlock)=var; store(%49,%data)` + callee `param:BorrowInParam(ParameterBlock)` + `load`.
2. `processGlobalParam` (slang-ir-spirv-legalize.cpp:480) — the pass that turns ParameterBlock→CB+bindings — runs **only on `IRGlobalParam`**. The temp `IRVar`, the `BorrowInParam(ParameterBlock)` param, and the `load`-materialized value are NOT global params → never legalized → the ParameterBlock type inst survives.
3. `emitGlobalInst` default case (slang-emit-spirv.cpp:2906) has no ParameterBlock case → ICE. GLSL twin at slang-emit-glsl.cpp:3811.

**Invariant:** opaque/resource/parameter-group types are ADDRESS-ONLY (non-copyable); a `BorrowIn` arg naming immutable storage must be passed by ADDRESS, never copied. Confirmed the class is broad, not ParameterBlock-only: `__constref RWStructuredBuffer<int>` crashes GLSL identically (`structured buffer type used unexpectedly`), while plain `in ParameterBlock<T>` compiles clean. Matches Yong's scope note ("all resource and opaque and non-copyable types").

**LOAD-BEARING prior art — read before fixing:** PR #8008 (copilot/fix-8002, CLOSED) took the front-end `addArg` special-case route; ArielG-NV rejected it 3× and closed: *"looks more like a hack … our IR should legalize or simplify the variable out … an entirely different approach is needed."* ⇒ Fix belongs in the IR (copy-elision), NOT AST lowering, NOT new decorations. Existing machinery: `isLoadFromImmutableAddress`+`updateCallSites` in slang-ir-transform-params-to-constref.cpp:186–255 already pass immutable addresses directly but only for auto-transformed `in`→`borrow in` params (and it excludes ParameterBlock); `undoParameterCopy` elides only decorated `store(var,load(orig))` temps — neither covers a user-written `__constref` whose source is a global.

**Env gotcha (this container):** `spirv-opt` fails to load (missing pthread) — but that's a *post-emission* step, so use GLSL as the clean crash/no-crash discriminator for SPIR-V-adjacent emit bugs; a spirv-opt load error actually means emission SUCCEEDED.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784754145569-slang-8002-constref-parameterblock-opaque-ice-copi.md`_
