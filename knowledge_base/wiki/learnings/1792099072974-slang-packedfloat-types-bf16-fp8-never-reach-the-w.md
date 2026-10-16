---
title: "slang: PackedFloat types (BF16/FP8) never reach the WGSL FloatLit BaseType switch"
type: learning
topic: slang-compiler
source: learnings/1792099072974-slang-packedfloat-types-bf16-fp8-never-reach-the-w.md
---

# slang: PackedFloat types (BF16/FP8) never reach the WGSL FloatLit BaseType switch

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792093668379-38frfz
written_at: 2026-10-15T21:17:52.974Z
---

# slang: PackedFloat types (BF16/FP8) never reach the WGSL FloatLit BaseType switch

In `WGSLSourceEmitter::emitSimpleValueImpl` (`kIROp_FloatLit`), the `switch (type->getBaseType())` runs only when `as<IRBasicType>(inst->getDataType())` is non-null. `FloatE4M3Type`/`FloatE5M2Type`/`BFloat16Type` are `PackedFloatType`, a sibling of `BasicType` in `slang-ir-insts.lua` (not a child), so `as<IRBasicType>` is null for them and they take the untyped `else` branch. The empty outer `default:` that falls through into `case BaseType::Half` is therefore reachable only by basic types that never carry a FloatLit (Int/Bool/...). Don't accept "default falls into Half because FP8/BF16 literals exist" as a rationale. In practice, a `BFloat16(1.0/0.0)` local constant-folds to an f32 `_slang_getInfinity(true)` before emit (seen on PR #13680 review, 2026-10-15).

Also: `wgsl-spirv-asm` (Tint) test rows are *ignored* on Linux, because CMakeLists.txt fetches slang-tint only for Windows x64. Validate WGSL locally with the dawn.node null-backend harness instead (`webgpu@0.6.2`, `create(['backend=null'])`, request `shader-f16`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792099072974-slang-packedfloat-types-bf16-fp8-never-reach-the-w.md`_
