---
title: "Slang IR address-space specialization: stable-root clone keys, recursion, the newWorkList hang, and export roots"
type: concept
group: slang-grab-bag
tags: [specializeAddressSpace, slang-ir-specialize-address-space, AddressSpaceContext, processModule, address-space, pointer, clone-cache, FuncSpecializationKey, recursion, E55201, newWorkList, hang, export, metal, wgsl, spirv, Unknown-addressspace]
source_count: 5
---

# Slang IR address-space specialization: stable-root clone keys, recursion, the newWorkList hang, and export roots

`slang-ir-specialize-address-space.cpp` (shared by SPIR-V, Metal and WGSL) gives every `Generic` pointer parameter and result a concrete address space by cloning functions per call-site address-space signature, starting from the entry points. Its bugs show up as hangs, unbounded clones (SIGSEGV), duplicate clones, or Metal's "Unknown addressspace encountered" abort. This page was split out of [IR type legalization](slang-compiler-ir-type-legalization.md); the Metal-side crash catalog is on [Slang Metal backend](slang-backends-metal.md).

## TL;DR

- **A cloning specialization pass must key its cache AND its cycle detection on the stable specialization origin, not the current callee** (already a clone on revisit): otherwise duplicate clones without recursion (#13643) and unbounded clone chains → SIGSEGV with it (#12563). Termination also needs per-drain dedup and a monotonic first-concrete-return result. Count clones on SPIR-V at -O0, since spirv-opt hides dead copies.
- **`specializeAddressSpace` hangs on pointer-returning functions while `newWorkList` is never cleared** (WGSL since #8668, SPIR-V #12498; fix in PR #12563). `-dump-ir` shows which pass hangs.
- **Under `-disable-non-essential-validations`, recursion reaches the pass**, because the E55201 recursion check runs only with non-essential validation on. Probe with pointer-return, scalar-return, permuted-argument and pointer-free recursion.
- **Dead-function removal after specialization must be a fixpoint**; one pass over the unordered candidate set orphans callees.
- **The worklist is seeded only from entry points**, so an uncalled `export` keeps `Generic` on its by-reference params; seeding exports is the principled fix, and it sends never-visited functions through every per-opcode handler, so probe each handler with shapes that used to reach only called code.
- **Count clones on SPIR-V at -O0**, and diff any fix against a master binary, not only its own tests.

## Recursion and clone keys: key on the stable root (#12563, #13643)

`slang-ir-specialize-address-space.cpp` (shared by SPIR-V/Metal/WGSL) assumes an acyclic call graph, which the recursion check E55201 guarantees only when `shouldRunNonEssentialValidation()` is on. Under `-disable-non-essential-validations` recursion reaches the pass and breaks it in several ways:

1. **Cycle detection keyed on a per-level identity cannot fire.** `specializeFunc` clones per `(func, argAddrSpaces)` and `cloneInst` points the recursive self-call at the clone, so a `HashSet<IRFunc*>` in-progress guard never repeats → unbounded clones → SIGSEGV. Record `clone → root` at clone time and break when a specialization would re-enter a root already on the stack.
2. **Break by reusing the callee AND caching it** (`functionSpecializations[key] = callee`); otherwise the worklist's later revisit clones again.
3. **The result address space must move monotonically** (Generic → concrete). With disagreeing returns, "last return wins" flips every drain and `retValAddrSpaceChanged` never settles; take the FIRST concrete return in iteration order. "Only set when Generic" is wrong: a bare `T*` result starts at a non-Generic default, so that guard drops diagnostics.
4. **Per-drain dedup** (`processedThisDrain`) bounds a drain where a recursive call re-adds its callee each visit (this also hangs pointer-free recursion like `fib` via the `!hasSpecializableArg` path).

Dead-function removal must be a fixpoint: one pass over the unordered `functionsToConsiderRemoving` orphans callees (Metal "Unknown addressspace encountered"). Probe recursion with controlled cases (pointer-return, scalar-return, permuted `recurse(a,b)→recurse(b,a)`, pointer-free `fib`). The portable regression is a compile-only cross-module `-target metal` build (`//TEST:COMPILE` the libs, then `//TEST:SIMPLE(filecheck=METAL): -r … -target metal`), runnable on Linux CI ([address-space specialization recursion under -disable-non-essential-validations; key cycle detection on the stable root](../learnings/1789475023606-address-space-specialization-recursion-under-disab.md)).

The same key mistake duplicates clones without recursion (#13643, fix #13648): `FuncSpecializationKey(callee, argAddrSpaces)` uses the call's current callee, which is a clone after the first visit. A set-worklist alone fixes only one of two revisit paths (`processFunction`'s `while(changed)` loop also re-walks calls), so nested `load2(){ return load(i); }` still gets two copies. Key on the specialization origin. Not WGSL-only: Metal shows it when `this` is a local, SPIR-V at -O0 (spirv-opt hides it at -O). Count clones with a regex such as `^(fn|float4) Span_load_[0-9]+\(` (bare `Span_load` also matches `Span_load2`); getenv-gated `fprintf` at VISIT/CLONE/CALL exposes the walk ([specializeAddressSpace cache keyed on current callee re-clones](../learnings/1792078260077-specializeaddressspace-cache-keyed-on-current-call.md)).

## A hang on any pointer-returning function: the never-cleared `newWorkList` (#12498, PR #12563)

`AddressSpaceContext::processModule` (~:700) declares `HashSet<IRFunc*> newWorkList` outside the `while (workList.getCount())` loop and never clears it, so once any function's result type changes its caller is re-queued forever and slangc hangs. On WGSL (since v2025.19 / #8668, which added `specializeAddressSpaceForWGSL`) a trivial `int* helper(int* x){return x;}` called from an entry point is enough; on SPIR-V it shows up as #12498 (`Optional<T*>`). The fix, resetting the set each round, is in open PR #12563. Triage: `-dump-ir` stopping after a pass names the hanging pass without gdb (the container has none), and release-tarball bisection (`releases/download/vX/slang-X-linux-x86_64.tar.gz`, then `LD_LIBRARY_PATH=rX/lib rX/bin/slangc` under `timeout`) brackets a hang regression in minutes [Slang WGSL/SPIR-V hang on pointer-returning functions = uncleared newWorkList in specializeAddressSpace](../learnings/1793321539458-slang-wgsl-spir-v-hang-on-pointer-returning-functi.md).

## Export roots: seeding uncalled exports exposes latent handler bugs (PR #12014, #11981, #14005)

An uncalled `export` function keeps `Generic` on its by-reference parameters, including by-value struct/array `in` parameters that `transformParamsToConstRef` rewrites to `BorrowInParam(T, Generic)`, and only Metal's emitter aborts on that (see [Slang Metal backend](slang-backends-metal.md)). Seeding exports as roots is the fix, with these consequences.

**New work-list roots reach handlers that only ever saw called code** (PR #12014, Metal exports, #11981/#14005). Making every Metal `export` a root of `specializeAddressSpace` sent never-visited functions through `processFunction`, and three latent shapes surfaced, all on programs master compiles. The `kIROp_BitCast` case maps its operand's address space even onto a non-pointer result, so `export uint64_t f(int* p){return bit_cast<uint64_t>(p);}` segfaults in the `Return` case (null `ptrResultType`). A function cloned during processing never joins `functionsToConsiderRemoving` unless a call to it was redirected, and clones keep `[KeepAlive]` from the export, so later DCE keeps them too: make every `specializeFunc` result a removal candidate. And the export's self-specialization key put `Generic` in the entry for a param that already had a space (a device buffer), so the call-site key never matched and the export was cloned into an identical copy; the fix built the key with `getAddressSpaceFromVarType(param)` and left the dead-function sweep as on master, since a keep-alive set for "seeded exports" emitted an unused `thread` copy once every call was redirected to a `threadgroup` clone. When a PR widens a pass's roots, probe each per-opcode handler with an input shape that previously reached only called code, and diff against a master binary ([NOT-only prefixes; new roots expose latent handler bugs](../learnings/1793280831784-filecheck-prefixes-with-only-not-lines-pass-when-t.md), [compare a fix against a master binary](../learnings/1793271336216-compare-a-compiler-fix-against-a-master-binary-not.md)).

**Source learnings (5):**
- [specializeAddressSpace: cache keyed on current callee re-clones; worklist dedup alone doesn't fix it](../learnings/1792078260077-specializeaddressspace-cache-keyed-on-current-call.md) — two revisit paths; key on origin (#13648); not WGSL-only; count at SPIR-V -O0
- [Address-space specialization: recursion under -disable-non-essential-validations, and keying cycle detection on the stable root](../learnings/1789475023606-address-space-specialization-recursion-under-disab.md) — clones make per-level identity useless for cycle detection (key the root); reuse+cache to break; monotonic first-concrete-return result; dead-func removal as a fixpoint; controlled recursion probes + a cross-module compile-only Metal regression.
- [FileCheck prefixes with only -NOT lines pass when the compile crashes; new pass roots expose latent handler bugs](../learnings/1793280831784-filecheck-prefixes-with-only-not-lines-pass-when-t.md) — exports as `specializeAddressSpace` roots: `kIROp_BitCast` segfault; clones must be removal candidates (#12014)
- [Compare a compiler fix against a master binary, not just its own tests](../learnings/1793271336216-compare-a-compiler-fix-against-a-master-binary-not.md) — three #12014 regressions; key via `getAddressSpaceFromVarType(param)`
- [uncleared `newWorkList` hangs WGSL/SPIR-V on pointer-returning functions; `-dump-ir` + release-tarball bisection](../learnings/1793321539458-slang-wgsl-spir-v-hang-on-pointer-returning-functi.md)

_Catalog: [[wiki/index.md]]_
