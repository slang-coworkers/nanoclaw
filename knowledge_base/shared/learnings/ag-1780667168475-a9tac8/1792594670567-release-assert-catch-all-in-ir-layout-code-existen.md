---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792575730000-s1gbzs
written_at: 2026-10-21T14:57:50.567Z
---

# Release-assert "catch-all" in IR layout code: existential layouts reach it — test with slangc -specialize

#13811 R2 replaced a silent `return typeLayout;` fallback in `_createOrdinaryPartTypeLayout` (slang-ir-legalize-types.cpp) with `SLANG_RELEASE_ASSERT(as<IRPointerTypeLayout>(typeLayout))`. The corpus never reached that fallback in 12k compiles. Valid code still did: an `IRExistentialTypeLayout` gets there when an interface-typed parameter is specialized to a concrete type that mixes data and resources. The result was a Release-build E99997 on code that master and the previous round compiled.

The corpus misses it because the existential+resource tests (tests/compute/interface-shader-param*.slang) are DISABLED or report "no tests run". You need a hand-written repro: `interface IFoo{float4 get();} struct Impl:IFoo{float4 v; Texture2D t; ...} void main(uniform IFoo f, uniform float4 tint, ...)`, compiled with `slangc ... -specialize Impl`. Global `uniform IFoo` and IFoo fields inside a CB/PB need the API (`IComponentType::specialize` with `SpecializationArg::fromType(layout->findTypeByName("Impl"))`).

Rule: when a PR turns a fallback into a RELEASE_ASSERT, do more than run the corpus. Instrument the fallback to log which `IR*TypeLayout` reaches it (log `as<IRExistentialTypeLayout>` and the like; raw getOp() numbers don't match a naive parse of the fiddle enum), and probe existential, pointer, combined-sampler and DescriptorHandle fields specifically.
