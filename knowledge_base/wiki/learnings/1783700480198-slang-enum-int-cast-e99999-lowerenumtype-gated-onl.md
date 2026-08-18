---
title: "slang enum→int cast E99999: lowerEnumType gated only on EnumType, not cast ops"
type: learning
topic: slang-compiler
source: learnings/1783700480198-slang-enum-int-cast-e99999-lowerenumtype-gated-onl.md
---

# slang enum→int cast E99999: lowerEnumType gated only on EnumType, not cast ops

**Symptom:** `enum : uint` → int cast aborts at emit with `internal error[E99999]: unexpected IR opcode during code emit`. Reproduces on ALL targets (hlsl/glsl/spirv/metal/wgsl/cuda/cpp). Issue shader-slang/slang#12048.

**Root cause:** `calcRequiredLoweringPassSet` (source/slang/slang-emit.cpp:436-437) sets `result.enumType = true` ONLY for `kIROp_EnumType`. It does NOT inspect the enum-cast opcodes `CastEnumToInt`/`CastIntToEnum`/`EnumCast`. The `lowerEnumType` pass is gated behind `if (requiredLoweringPassSet.enumType)` at slang-emit.cpp:1276-1277.

**The trap (constant folding strands a cast):** when an enum-typed LOCAL holds a compile-time constant (`XYZ xyz = XYZ.One; buf[0] = xyz;`), SSA/mem2reg + constant-fold eliminate the local AND the last `IREnumType` reference, but leave a *degenerate* `let %x : UInt = CastEnumToInt(1 : UInt)` (operand+result both the tag type). No live EnumType → `enumType` stays false → `lowerEnumType` SKIPPED → stranded cast reaches emit → E99999.

**Discriminator:** an enum-typed **local var** holding a const is what reproduces. A direct `(uint)XYZ.One` with no local folds cleanly and does NOT crash. A runtime enum value `(XYZ)tid.x` keeps the enum type alive so the pass runs. Member count is irrelevant.

**Fix pattern (principled, at the gate):** add the enum-cast opcodes (`kIROp_CastEnumToInt`/`CastIntToEnum`/`EnumCast`, + `Constexpr*` variants) to the switch in `calcRequiredLoweringPassSet` so `enumType` is flagged whenever ANY enum op survives — not just the type. Direct precedent in the same function: `taggedUnion` (slang-emit.cpp:561-568) flags on ALL its ops, not just `TaggedUnionType`. `lowerEnumType`→`processEnumCast` (slang-ir-lower-enum-type.cpp:91) calls `emitCast`, which drops a same-type cast via `isTypeEqual` (slang-ir.cpp:4270) — so the pass is fully capable once it runs.

**General lesson:** any lowering pass gated by a `RequiredLoweringPassSet` flag that keys ONLY on a TYPE opcode is fragile — constant folding / specialization can delete the type while leaving an op that still needs the pass. Gate on the *ops* too. Verify by `-dump-ir`: a missing pass header + the op surviving to `### AFTER checkUnsupportedInst` is the signature. See also the #11917 RequiredLoweringPassSet gating epic.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783700480198-slang-enum-int-cast-e99999-lowerenumtype-gated-onl.md`_
