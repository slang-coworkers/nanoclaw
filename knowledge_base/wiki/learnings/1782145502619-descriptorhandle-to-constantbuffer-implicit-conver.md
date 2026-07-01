---
title: "DescriptorHandle to ConstantBuffer implicit conversion blocked by ParameterGroupType target guard in _coerce"
type: learning
topic: ci-tooling
source: learnings/1782145502619-descriptorhandle-to-constantbuffer-implicit-conver.md
---

# DescriptorHandle to ConstantBuffer implicit conversion blocked by ParameterGroupType target guard in _coerce

**Issue:** shader-slang/slang#11681 — `DescriptorHandle<ConstantBuffer<T>>` fails to implicitly convert to `ConstantBuffer<T>` (error E30019), while the same form works for `RWStructuredBuffer`/`Texture2D`/`SamplerState`. Reproduced on TOT (HEAD 2b14ffd06, Debug slangc).

**Root cause (proven):** `source/slang/slang-check-conversion.cpp:2188-2195`, inside `_coerce`:
```cpp
// Disallow converting to a ParameterGroupType.
// TODO(tfoley): Under what circumstances would this check ever be needed?
if (as<ParameterGroupType>(toType))
    return _failedCoercion(toType, outToExpr, fromExpr, sink);
```
This unconditionally fails any coercion whose **target** is a `ParameterGroupType`, *before* the constructor-based implicit-conversion search (`getImplicitConversionCostWithKnownArg`). `ConstantBufferType : UniformParameterGroupType : ParameterGroupType` (`slang-ast-type.h:509`), so the generated `__init(DescriptorHandle<ConstantBuffer<T,L>>)` implicit-conversion is never reached. `RWStructuredBuffer` is NOT a ParameterGroupType → guard skipped → conversion found. That asymmetry is the entire bug; also affects `TextureBuffer`.

**Non-obvious points that mislead investigation:**
- The conversion is NOT missing for ConstantBuffer. It's a generated `__init` marked `__implicit_conversion`, emitted per-type by a meta-program loop over the `kDynamicResourceCastableTypes` table at `hlsl.meta.slang:27033-27081`, and **ConstantBuffer IS in that table** (`:27044`).
- Lowering is NOT the problem either — `getDescriptorFromHandle`/`defaultGetDescriptorFromHandle` has a working `case DescriptorKind.ConstantBuffer:` (`hlsl.meta.slang:27307`), proven by the passing explicit-call tests `tests/spirv/descriptor-heap-constant-buffer*.slang`.
- The gating interface `IOpaqueDescriptor` is satisfied by ConstantBuffer (docs `03-convenience-features.md:613-614` list it), so the constraint is NOT the discriminator. `ParameterBlock` differs — it does NOT conform (`tests/spirv/descriptor-heap-parameter-block-error.slang`), so it's rejected earlier at the type level.

**Fix direction:** carve DescriptorHandle sources out of the line-2192 guard (low blast radius), or remove/reorder the guard per its own `:2190` TODO (more principled, git-blame first). Expected front-end-only — no legalize/emit cascade since the explicit path already lowers ConstantBuffer correctly. Docs are correct; no docs change.

**Useful contrast test for a regression:** `tests/language-feature/descriptor-handle/bindless-implicit-use.slang:19-20` assigns `DescriptorHandle<Texture2D>`/`DescriptorHandle<SamplerState>` straight into resource-typed variables (works) — mirror it with `ConstantBuffer<T>`.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1782145502619-descriptorhandle-to-constantbuffer-implicit-conver.md`_
