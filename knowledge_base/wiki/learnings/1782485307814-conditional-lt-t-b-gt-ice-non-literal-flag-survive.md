---
title: "Conditional&lt;T,b&gt; ICE: non-literal flag survives lowerConditionalType to spirv-emit"
type: learning
topic: slang-compiler
source: learnings/1782485307814-conditional-lt-t-b-gt-ice-non-literal-flag-survive.md
---

# Conditional&lt;T,b&gt; ICE: non-literal flag survives lowerConditionalType to spirv-emit

# `Conditional<T,b>` → `makeConditionalValue` ICE in spirv-emit (slang #11782)

**Symptom:** `InternalError unimplemented: Unhandled local inst in spirv-emit: makeConditionalValue(...)`.

**Mechanism (source-verified @1a0c2a6d1):**
- `Conditional<T, bool hasValue>` (core.meta.slang:1875-1909): `__init(T)` is `__intrinsic_op(kIROp_MakeConditionalValue)` + `__implicit_conversion`. So a `makeConditionalValue` is produced wherever a `T` is implicitly converted to a `Conditional<T,b>` (e.g. passing a float3 to a `Conditional<float3,b>` param), and by `set()`.
- `lowerConditionalType` (slang-ir-lower-conditional-type.cpp) only resolves a `ConditionalType` whose `hasValue` is an `IRBoolLit`/`IRIntLit` (:63-75). If `hasValue` is a still-symbolic `IRParam`, it `return`s without recording the type; `processMakeConditionalValue` (:107-109) then finds `!info` and **silently leaves the inst in place** (no diagnostic). It reaches `slang-emit-spirv.cpp:4832` which has NO `MakeConditionalValue` case → ICE. (`MakeOptionalValue` is similarly unhandled in emit but is always eliminated by lowering first.)
- Pass order (slang-emit.cpp): specializeModule(1315) → specializeHigherOrderParameters(1323) → finalizeAutoDiffPass(1326) → finalizeSpecialization(1331) → **lowerConditionalType(1338)**.

**Root layer:** Design invariant (DeepWiki-confirmed) = `hasValue` is ALWAYS a literal by lowering time (Conditional's purpose is static field-elision; a non-literal flag implies dynamic size, which the type does not support). So a non-literal flag at emit = an UPSTREAM producer leaked an unresolved generic value param. The 3 categories that leak unresolved value params past specialization and run BEFORE lowering: **set-specialized generics** (dynamic dispatch), **`specializeHigherOrderParameters`** (IFunc callbacks), **`finalizeAutoDiffPass`** (differentiable code). Principled fix is producer-side (monomorphize the finite 2-valued bool param); a lowering-pass diagnostic is only a defensive guard, not the fix.

**REPRO GOTCHA (cost me 12+ variants):** In a single-file AOT compile, `specializeModule` ALWAYS folds a `<let b:bool>` value param to a concrete literal, so the Conditional lowers cleanly and you CANNOT reproduce "generic-value-param-escapes-specialization" bugs that way. extern/link-time const flags with a default also fold; spec-constants are rejected as non-constant generic args. The only minimal trigger I found was `[Differentiable]` + `Conditional<float3,b>` + `bwd_diff` (crashes with a *different* E99999 at `.get()`, but same machinery). To repro this class: use autodiff, dynamic dispatch (set-specialization), or higher-order params — not a plain entry-point call.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782485307814-conditional-lt-t-b-gt-ice-non-literal-flag-survive.md`_
