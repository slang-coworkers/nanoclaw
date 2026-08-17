---
title: "DescriptorHandle is uint64-native under spvBindlessTextureNV (not uint2) — and test a reviewer's proposed alt before agreeing"
type: learning
topic: review-process
source: learnings/1784762549887-descriptorhandle-is-uint64-native-under-spvbindles.md
---

# DescriptorHandle is uint64-native under spvBindlessTextureNV (not uint2) — and test a reviewer's proposed alt before agreeing

## Fact: `DescriptorHandle<T>` SPIR-V representation is capability-dependent

In `hlsl.meta.slang`, `DescriptorHandle<T>` has **two** conversion casts (~27524-27539):
- `(uint2)handleValue` → `kIROp_CastDescriptorHandleToUInt2`, gated `[require(glsl_spirv)]`
- `(uint64_t)handleValue` → `kIROp_CastDescriptorHandleToUInt64`, gated `[require(spvBindlessTextureNV)]` / `[require(cuda)]`

**Under `spvBindlessTextureNV` (and cuda) the handle's SPIR-V representation is a scalar `%ulong` (uint64), NOT a `uint2`.** The plain `spirv`/`glsl` path represents it as `uint2`. Confirmed by `DescriptorHandle::equals`/`lessThan` (~27485-27500): they select `(uint64_t)this` for the `spvBindlessTextureNV`/`cuda` arms and `(uint2)this` for the default arm.

Consequence: in the `case spvBindlessTextureNV:` arm of `defaultGetDescriptorFromHandle`, the acceleration-structure cast must be `RaytracingAccelerationStructure((uint64_t)handleValue)` — NOT `RaytracingAccelerationStructure(__asuint64((uint2)handleValue))` (which is what the `spirv`/`glsl` sibling arm uses, because *its* handle is uint2). Feeding `__asuint64` (which expects `%v2uint`) the `%ulong` handle fails SPIR-V validation: `OpFunctionCall Argument's type does not match Function %v2uint's parameter type` → E99999. `RaytracingAccelerationStructure.__init(uint64_t address)` emits `OpConvertUToAccelerationStructureKHR` either way.

## Process lesson (the durable one)

A maintainer (jkwak-work, PR #12186) proposed the `__asuint64((uint2)...)` form as "shouldn't this be...". Instead of reasoning it out or deferring, I **swapped in his exact form, rebuilt the core module + slangc, and compiled the repro** — it failed spirv-val. That empirical result turned a potentially wrong "you're right, changing it" into a proof-backed "I tried it, here's the validation error, here's why the current form is correct." Always compile a reviewer's proposed alternative before agreeing or disagreeing when it's cheap to do so — a 5-min build settles it definitively and the reviewer gets evidence, not opinion.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784762549887-descriptorhandle-is-uint64-native-under-spvbindles.md`_
