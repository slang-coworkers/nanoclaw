---
title: "WGSL emit: static-const arrays must be var<private> (not const) for runtime indexing"
type: learning
topic: slang-compiler
source: learnings/1781624737396-wgsl-emit-static-const-arrays-must-be-var-private-.md
---

# WGSL emit: static-const arrays must be var<private> (not const) for runtime indexing

**Context:** shader-slang/slang#6747 / PR #11628. A `static const` array indexed by a runtime value (`positions[SV_VertexID]`) emitted invalid WGSL: `const positions_0 : array<...>` then `positions_0[vertexID]` — naga/tint reject it ("The expression may only be indexed by a constant"). A WGSL `const` is a compile-time value (≈C++ constexpr); the WGSL spec only lets a *value* of array type be indexed by a const-expression.

**Fix layer:** `source/slang/slang-emit-wgsl.cpp` `emitVarKeywordImpl`. A module-scope `static const` lowers to `IRGlobalConstant` wrapping `IRMakeArray`; the **declared inst is the MakeArray value** (a module-scope ordinary inst), and `emitInstResultDecl` (slang-emit-c-like.cpp:2018) emits `<keyword> <name> : <type> = <initializer>` with the keyword from `emitVarKeywordImpl` and **the initializer emitted inline regardless of keyword**. So flipping the keyword `const`→`var<private>` for module-scope array/matrix constants yields `var<private> x : array<...> = array<...>(...)` — a legal module-scope private var with a const-expression initializer, runtime-indexable. (Do NOT use the `static`-only/non-const path — it hoists the initializer into an init function and produces broken `const _S3 = ...` statements.) Keep scalars/vectors as `const`.

**Non-obvious — why this does NOT break `static const x = arr[0]` (const-index chains):** a constant index into a const array is folded away before emit, so no `const` is left reading the now-`var<private>` array. Mechanism: `replaceGlobalConstants` (slang-emit.cpp:989) inlines GlobalConstant values into uses BEFORE `simplifyIR` (slang-emit.cpp:1249); then peephole (slang-ir-peephole.cpp:884, `kIROp_GetElement` case) folds `GetElement(MakeArray, IRIntLit)` to the element but `if (!index) break;` leaves a runtime index intact. Const-only-indexed arrays are then DCE'd. So a simple **type-based** conversion (all module-scope array/matrix constants) is safe — no use-analysis needed. (codex flagged the chain regression as must-fix; the peephole+replaceGlobalConstants pipeline is the evidence that closed it.)

**tests/wgsl/ filecheck convention:** GPU-free text check via `//TEST:SIMPLE(filecheck=WGSL): -stage vertex -entry <e> -target wgsl` + `// WGSL: ...` / `// WGSL-NOT: ...` (model: tests/wgsl/buffer-array.slang). Place a `WGSL-NOT` BEFORE the following positive `WGSL:` so its region covers where a bad surviving global would appear. WGSL floats emit fixed-notation with `f` suffix (`0.5f`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781624737396-wgsl-emit-static-const-arrays-must-be-var-private-.md`_
