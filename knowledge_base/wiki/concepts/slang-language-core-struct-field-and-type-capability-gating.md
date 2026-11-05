---
title: "Slang capability gating of a type and of struct fields (fp64 double, #10232 / PR #14332)"
type: concept
group: slang-language-core
tags: [slang, capability, require, capability-inference, fp64, double, struct-fields, CapabilityDeclReferenceVisitor, visitDeclRefType, visitedVals, kMaxTypeNestingDepth, type-legalization, E36104, E36107, BFloat16, wgsl, metal]
source_count: 5
---

# Slang capability gating of a type and of struct fields (fp64 double, #10232 / PR #14332)

What happens when a builtin type gets a `[require(...)]`, and how to make a struct's field types count where the struct is used. The worked case is #10232: WGSL and Metal crash on `double` instead of reporting it, and open PR #14332 gates `double` behind a new `fp64` capability. Gating the type is easy; it is the struct-field join that exposes the hard traps. The decl-ref walk itself, the stale-caps declaration-order bug and the "members never feed a struct's own set" rule are on [Slang capability inference](../concepts/slang-language-core-capability-inference.md); where E36100/E36107 fire is on [capability-check scope](../concepts/slang-compiler-capability-check-scope-and-core-intrinsic-changes.md).

## TL;DR

- A type-level `[require(X)]` reaches every function that names the type (local types, parameters, decl-ref operands such as `double.init` and `operator+`) and fails at entry-point validation as E36107, with a "see using of 'double'" note at the user's line.
- The check runs on the AST before optimization, so code that compiles today because the value folds away becomes an error. Gating an existing type is source-breaking: ask the maintainer first.
- On master a struct's capability set is only its own `[require]`, so a gated type in an unread struct field escapes the check entirely.
- Join a struct's field requirements where the struct is USED, never into the struct's own `inferredCapabilityRequirements`, which its methods read as their declared set (E36104).
- Trigger the join on the type (`visitDeclRefType`), not on every decl-ref to the struct; a decl-ref trigger gates generic qualifiers such as `Outer<int>.Inner` and `G<float>.f()`.
- Dedup the field walk by specialized type (the visitor's `visitedVals`), never by `StructDecl*`, and bound it at `kMaxTypeNestingDepth`; recursive variadic structs otherwise crash.
- Skip opaque-handle fields, arrays included: type legalization moves them out of the struct, and joining them gives false E36107 (Metal `ParameterBlock` keeps them).
- Closing one gap exposes stale `[require]`s elsewhere. A `MemberDeclRef` member's own requirements and global/static initializers both break valid code; only field requirements are safe to join.
- Default arguments need a visit at each call that omits them, with a per-walk visited set, or a recursive struct's synthesized constructor recurses until SIGSEGV.
- Link-time `-conformance` types get no capability check at all.
- BFloat16/FloatE4M3's `[require(cuda_sm_8_0)]` is vacuous on metal/wgsl/hlsl; it is not a working precedent.
- Verify with a compile-only sweep of every WGSL/Metal `//TEST` line, master vs fix, and add targeted probes: the sweep finds neither the resource-field nor the generic-qualifier false positive.

## Type-level `[require]`: what it reaches, and why gating `double` breaks code

A `[require(X)]` on a core-module type (`core.meta.slang`) propagates through `CapabilityDeclReferenceVisitor` (`slang-check-decl.cpp` ~22303) into every function that references the type: local variable types, decl-ref operands such as `double.init` and `operator+`, and parameters. It is reported at entry-point validation as E36107 "unavailable features in entry point". Because this runs on the AST, before any optimization, `double d = 1.25; o[0] = (float)d;`, which compiles today because the value folds away, becomes an error. The core module itself breaks until `double.__min`/`__max` get `[require(fp64, sm_4_0_version)]` and `copysign_double` is re-gated, and including `c` in the alias gives E36104 [type gating is AST-time and misses unread fields](../learnings/1793819445773-slang-capability-gating-on-a-type-ast-time-rejects.md).

Do not copy the existing BFloat16/FloatE4M3 `[require(cuda_sm_8_0)]`: it is vacuous on metal, wgsl and hlsl, because `cuda_sm_8_0` → `cuda_sm_6_0` includes `sm_4_1`, and `sm_4_1_version` includes `metal|wgsl|cpp|llvm` (capdef ~1759/~2284). `BuiltInTriangleIntersectionAttributes` (`hlsl.meta.slang`) is a precedent that does work [type gating is AST-time and misses unread fields](../learnings/1793819445773-slang-capability-gating-on-a-type-ast-time-rejects.md).

## Joining struct-field requirements at the use site

On master `struct S { float a; double b; }` used through `RWStructuredBuffer<S>` with only `a` read never reaches `double`'s `[require]` [type gating is AST-time and misses unread fields](../learnings/1793819445773-slang-capability-gating-on-a-type-ast-time-rejects.md). PR #14332 closes that by joining each struct's instance-field requirements wherever the struct is used. The join must not go into the struct's own `inferredCapabilityRequirements`: `getDeclaredCapabilitySet` treats that set as the declared set of the struct's methods, so a method calling `min` then hits E36104, which is exactly the failure core `double.__min` showed [closing gaps exposes stale requires](../learnings/1793841008790-slang-capability-inference-closing-gaps-exposes-st.md).

The first version (round 1) joined fields from `CapabilityDeclReferenceVisitor::processReferencedDecl` on decl-refs, including the inner struct of a `GenericDecl`, base structs and `MemberDeclRef` structs [closing gaps exposes stale requires](../learnings/1793841008790-slang-capability-inference-closing-gaps-exposes-st.md). Review found two false positives. First, resource-typed fields were joined, although type legalization moves them out of the struct and they never appear in the emitted layout: `struct G { Buffer<float> b; RWStructuredBuffer<float> o; }` in a `ParameterBlock`, with only `o` used, compiles on master for wgsl (naga accepts it) and cuda/ptx, but on the PR gives E36107 through `__ShapeBuffer`, which is `[require(cpp_glsl_hlsl_metal_spirv)]`; `RWBuffer` behaves the same. Second, the trigger fired on the decl-ref shape (a `GenericDecl` reference), so a generic struct used only as a qualifier, such as `Outer<int>.Inner` or `G<float>.f()`, picked up its fields while its non-generic twin did not [resource fields cause false E36107](../learnings/1793844879718-capability-join-of-struct-fields-resource-fields-c.md).

The shape that addresses both hooks `visitDeclRefType` in `CapabilityDeclReferenceVisitor`, so the join fires on the type rather than on any decl-ref to the declaration. It walks the specialized fields with `getFields(astBuilder, structDeclRef, MemberFilterStyle::Instance)` plus `getType`, and the base with `findBaseStructType`. It skips opaque-handle fields, arrays included, because legalization moves them out; Metal `ParameterBlock` is the exception, since it keeps resources in the argument buffer [dedup by specialized type, bound the depth](../learnings/1793854956475-capability-walk-over-struct-field-types-dedup-by-s.md).

## Dedup by specialized type, and bound the depth

A field walk that deduplicates with `HashSet<StructDecl*>` ("first specialization we meet") is wrong. The argument for it was that later specializations' generic arguments are visited as operands anyway, but that holds only for fields typed `T`, not for fields computed from `T`. Consider `struct Pair { Box<A> x; Box<B> y; }` where `Box<T>` has a field of type `T.Assoc` and `B.Assoc = double`: `Box<B>`'s field is never visited, and swapping `x` and `y` brings the diagnostic back. Dedup by the specialized type instead. The visitor's `visitedVals` already does this, because `Val`s are hash-consed and one specialization is one pointer. Recursive generic structs such as `LoopField<each T> { LoopField<T,int> next; }` make a new type per level, so bound the walk with a depth counter at `kMaxTypeNestingDepth`, as `collectGenericStructTypeUses` in `slang-check-shader.cpp` does; without the bound the pack-branch-* and recursive-variadic tests crash with SIGSEGV. When reviewing any walk keyed on `Decl*` rather than `DeclRef`/`Type`, probe two specializations with an associated-type field, in both orders [dedup by unspecialized decl misses specialization-dependent fields](../learnings/1793852431491-dedup-by-unspecialized-decl-in-ast-type-walks-miss.md) [dedup by specialized type, bound the depth](../learnings/1793854956475-capability-walk-over-struct-field-types-dedup-by-s.md). A binary-recursive `Tree<each T> { Tree<T,int> l; Tree<T,float> r; }` already hangs on master, so it is not a regression signal [dedup by specialized type, bound the depth](../learnings/1793854956475-capability-walk-over-struct-field-types-dedup-by-s.md).

## Closing one gap exposes stale `[require]`s elsewhere

Each other gap closed alongside the field join on PR #14332 rejected code that master compiles [closing gaps exposes stale requires](../learnings/1793841008790-slang-capability-inference-closing-gaps-exposes-st.md):

- **Initializers.** Making `checkVarDeclCommon` visit global/static initializers broke `tests/bugs/13074/*` (HLSL `&` in a static resource initializer) and `static-const-struct-array-resource-13107` (CUDA `DescriptorHandle.init`). It was reverted and needs its own design.
- **`MemberDeclRef` members.** Processing a `MemberDeclRef` member's *own* requirements broke the core-module build (E36104 at `coopVecLoad` vs `CoopVec.load` / `optix_coopvec`). Only field requirements are safe to join there.
- **Default arguments.** Lowering inserts a parameter's default at each call that omits it, so the walk visits the parameter's `initExpr` there. It needs a per-walk visited set of parameters: a recursive struct's synthesized constructor has a default that calls itself, and without the set it recursed until SIGSEGV (`recursive-variadic-field-specialization-budget.slang`). The crash showed only under the test server.
- **Link-time `-conformance` types** get no capability check at all, even an explicit `[require(hlsl)]` on wgsl/metal/spirv.

## Verification and tooling

Run a compile-only sweep of every WGSL and Metal `//TEST` line, master vs fix (889 configs on #14332). wgpu and metal runtime tests are ignored on Linux, so the sweep is the real signal for those targets [closing gaps exposes stale requires](../learnings/1793841008790-slang-capability-inference-closing-gaps-exposes-st.md). The sweep finds neither of the round-1 false positives, so for any capability-propagation change also probe base vs head with gated resource fields (`Buffer`/`RWBuffer` are the gated ones today) and with generic qualifiers, on wgsl, metal and cuda [resource fields cause false E36107](../learnings/1793844879718-capability-join-of-struct-fields-resource-fields-c.md).

Slang's `-DFOO` without a value defines an EMPTY macro, so `#if FOO` gives E15201; use `-DFOO=1` or `#ifdef` [closing gaps exposes stale requires](../learnings/1793841008790-slang-capability-inference-closing-gaps-exposes-st.md). The deliver-gate hook blocks even read-only `gh api` calls whose path contains `pulls`; use the slang-mcp PR tools for reads [type gating is AST-time and misses unread fields](../learnings/1793819445773-slang-capability-gating-on-a-type-ast-time-rejects.md).

**Source learnings (5):**
- [capability gating on a type: AST-time, rejects folded code, misses unread struct fields; BFloat16 require vacuous](../learnings/1793819445773-slang-capability-gating-on-a-type-ast-time-rejects.md) — E36107 "see using of 'double'"; core `double.__min` re-gating; working precedent
- [closing capability gaps exposes stale requires](../learnings/1793841008790-slang-capability-inference-closing-gaps-exposes-st.md) — use-site field join OK; initializers / MemberDeclRef members break; default-arg recursion; 889-config sweep
- [capability join of struct fields: resource fields cause false E36107](../learnings/1793844879718-capability-join-of-struct-fields-resource-fields-c.md) — `__ShapeBuffer` via legalized-out fields; decl-ref trigger gates generic qualifiers
- [dedup by unspecialized decl misses specialization-dependent field types](../learnings/1793852431491-dedup-by-unspecialized-decl-in-ast-type-walks-miss.md) — `T.Assoc` field; field-order dependent; probe both orders
- [capability walk over struct fields: dedup by specialized type + depth bound](../learnings/1793854956475-capability-walk-over-struct-field-types-dedup-by-s.md) — `visitDeclRefType` hook; `visitedVals`; `kMaxTypeNestingDepth`; skip opaque handles
