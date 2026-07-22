---
title: "static_assert(false) in a switch(T.kind) arm fires EAGERLY for generic export functions"
type: learning
topic: slang-compiler
source: learnings/1784691233062-static-assert-false-in-a-switch-t-kind-arm-fires-e.md
---

# static_assert(false) in a switch(T.kind) arm fires EAGERLY for generic export functions

**Context:** slang#12185 — fixing `defaultGetDescriptorFromHandle` in hlsl.meta.slang to diagnose (not abort) unsupported `DescriptorHandle` kinds under `spvBindlessTextureNV`.

**The trap:** I put `static_assert(false, "...")` inside a `switch(T.kind)` case (ConstantBuffer/StorageBuffer arms) of a generic `[ForceInline]` function, expecting it to fire only when those kinds are actually instantiated (per-specialization gating). It worked for a CONCRETE call site (my test's AS-only variant compiled fine). BUT `tests/.../desc-handle-default.slang` defines its OWN `export T getDescriptorFromHandle<T:IOpaqueDescriptor>(...)` wrapper — and compiling a **generic `export` function** type-checks its body with `T` SYMBOLIC, so `switch(T.kind)` can't fold and the `static_assert(false)` fires UNCONDITIONALLY (E41400), even when only AS is used. That would break every user who provides a custom `getDescriptorFromHandle` and compiles with the capability — even for textures. A real regression, caught by running the reporter's R3 repro (not just my own test).

**Why the existing `static_assert(false)` at hlsl.meta.slang:27778 is fine but mine wasn't:** that one sits in the `default:` of `switch(bindlessOptions)` where `bindlessOptions` is a **`constexpr` function param** (always a concrete literal at the call), and every real enum value has an explicit case so `default` is genuinely unreachable per-call. `T.kind` in a generic `export` wrapper is NOT concrete during the generic check.

**Rule:** Do NOT use `static_assert(false, ...)` in a `switch(T.kind)`/generic-`static const` arm of a function that can be compiled generically (especially anything `export`, or a customization point users can re-declare generically). It fires at the generic type-check, not per-specialization. For "this kind is unsupported on this target," emit the diagnostic at the CONSUMER (IR emit stage) where the type is concrete — add a proper `err()` in slang-diagnostics.lua and `m_sink->diagnose(Diagnostics::YourDiag{.type=resultType, .location=inst->sourceLoc})`. A plain `if (T.kind == X) return ...; else return ...;` is safe (both arms type-check generically); only the compile-time-FAIL construct is the problem.

**General lesson:** always run the REPORTER's exact repro commands, not just your own minimal test — the export-wrapper path only showed up in their `desc-handle-default.slang`, which has a customization-point wrapper my standalone test lacked.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784691233062-static-assert-false-in-a-switch-t-kind-arm-fires-e.md`_
