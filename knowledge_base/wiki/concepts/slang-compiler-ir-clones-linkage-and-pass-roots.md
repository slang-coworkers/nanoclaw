---
title: "Slang IR passes that clone or keep functions: linkage decorations on clones, keep-alive originals, widened work-list roots, and lazily lowered values"
type: concept
group: slang-compiler
tags: [slang, ir, clone, linkage, IRExportDecoration, removeLinkageDecorations, DownstreamModuleExportDecoration, AvailableInDownstreamIRDecoration, specializeAddressSpace, obfuscate, preserve-params, legalizeByteAddressBufferOps, precompiled-modules, metal, wgsl, spirv]
source_count: 5
---

# Slang IR passes that clone or keep functions: linkage decorations on clones, keep-alive originals, widened work-list roots, and lazily lowered values

Several Slang IR passes specialize a function by cloning it, and then decide which of the original and the clones survive. Two families of bugs follow from that. The first is about linkage: a clone that keeps the original's export decoration produces duplicate emitted names, and stripping that decoration carelessly leaves dependent decorations that crash later. The second is about reach: a pass that only processes what reaches it from its roots leaves stale bodies or unlowered values whenever another change keeps more things alive. Most of the evidence comes from `specializeAddressSpace` (`slang-ir-specialize-address-space.cpp`) during #14004/#14008 and PR #12014. The Metal "Unknown addressspace" crash that motivated seeding exports is on [[wiki/concepts/slang-backends-metal.md]]; the same lazy-registration pattern in `lowerCombinedTextureSamplers` is on [[wiki/concepts/slang-backends-combined-sampler-type-lowering-and-layouts.md]].

## TL;DR

- **A clone that keeps the original's `IRExportDecoration` is emitted under the same linkage name.** Under `-obfuscate`, name hints are stripped, and `CLikeSourceEmitter::generateName` (`slang-emit-c-like.cpp` ~1270) uses the linkage name verbatim with no `_generateUniqueName`, so two functions get the same `_Sh<hash>` name and WGSL rejects the redeclaration (#14004). Without `-obfuscate`, name hints hide the bug (`foo_0`, `foo_1`).
- **Precedent for clones:** keep linkage only when one specialization cleanly replaces a dead original (`slang-ir-lower-buffer-element-type.cpp` ~1909); otherwise call `removeLinkageDecorations` (`slang-ir-util.cpp`) on every clone, as specialize-function-call and fix-entrypoint-callsite do.
- **Stripping export linkage must also strip the decorations that depend on it.** `DownstreamModuleExportDecoration` consumers call `findDecoration<IRExportDecoration>()->getMangledName()` and segfault in the precompile producer (`-embed-downstream-ir`); `AvailableInDownstreamIRDecoration` makes `removeAvailableInDownstreamModuleDecorations` strip the body and add a `DownstreamModuleImport`, which crashes the consumer compile.
- **`removeLinkageDecorations` is shared** with lower-buffer-element-type and autodiff, so dropping a decoration case from it to suit one pass can bring back crashes in the others.
- **Keep alive only the originals that must stay.** Only originals carrying `DownstreamModuleExportDecoration` (DXIL/SPIR-V only) need to survive; keeping every `[KeepAlive]` original made Metal crash on `export` functions with `inout` params (#11981, "Unknown addressspace").
- **When a change makes a pass keep a function it used to delete, the pass must also visit that function's body.** Kept `specializeAddressSpace` originals held bodies the pass never processed, producing ill-typed SPIR-V (a `Function` param receiving a `Workgroup` arg) that `-incomplete-library` never validates. Seed every kept function into the work list.
- **Widening the set of roots exposes latent per-inst bugs.** Seeding exports as roots on Metal (PR #12014) sent unseen bodies through `processFunction`: the `BitCast` case copied an address space onto a non-pointer result (segfault), and clones made inside a seeded root's body were never dead-function candidates. Map an address space only when the result is an `IRPtrTypeBase`; add every clone to the candidates and sweep to a fixpoint.
- **The same reach problem exists for params.** `-preserve-params` keeps every `global_param` alive, so a lazy translate-on-use pass such as `legalizeByteAddressBufferOps` leaks every param no op reaches to SPIR-V emit ("Unhandled global inst ... ByteAddressBuffer").
- **Probe recipe for a cloning pass:** compile with and without `-obfuscate` and compare the emitted function-name lists; give new roots unusual bodies (int↔pointer bitcasts, atomics, helper chains, mixed-space calls) and diff against a master binary, not only your own tests.
- **Precompiled-module tests:** a failed SPIR-V link prints a SPIRV-TOOLS message, exits 0 and writes nothing, so use `TEST:SIMPLE(filecheck)` on `-target spirv-asm`, not `TEST:COMPILE`; if the library has its own entry point, both modules need `-fvk-use-entrypoint-name`.

## Linkage on clones: duplicate emitted names under `-obfuscate` (#14004)

Under `-obfuscate`, name hints are stripped. `CLikeSourceEmitter::generateName` (`slang-emit-c-like.cpp` ~1270) then names a function from its linkage (export) name verbatim, without the `_generateUniqueName` suffixing that hinted names get. So any IR pass that clones a function and keeps the original's `IRExportDecoration` on the clone creates two emitted functions with the same `_Sh<hash>` name. Without `-obfuscate`, the name-hint path hides the collision (`foo_0`, `foo_1`); with it, WGSL fails with a redeclaration error. Address-space specialization (`specializeFunc`) had exactly this bug (#14004) ([-obfuscate: IR clones that keep [export] get the same emitted name](../learnings/1793263779351-obfuscate-ir-clones-that-keep-export-get-the-same-.md)).

The codebase already has a rule for this. In `slang-ir-lower-buffer-element-type.cpp` (~1909), linkage stays only when a single specialization cleanly replaces an original that is dead; otherwise every clone gets `removeLinkageDecorations` (`slang-ir-util.cpp`). specialize-function-call and fix-entrypoint-callsite also strip linkage from their clones. The quick check for any cloning pass is to compile with and without `-obfuscate` and compare the emitted function-name lists for duplicates ([same](../learnings/1793263779351-obfuscate-ir-clones-that-keep-export-get-the-same-.md)). How `-obfuscate` hashes every linkage name is on [[wiki/concepts/slangc-target-output-and-obfuscation.md]]. How the C-like emitters name declarations, and the other path that bypasses `_generateUniqueName` (`__extern_cpp` field names), is on [[wiki/concepts/slang-backends-c-like-emitted-names-and-uniquing.md]].

## Stripping linkage: dependent decorations (#14004, PR #14008)

`removeLinkageDecorations` removed `ExportDecoration` but left two decorations whose consumers assume it is present ([stripping linkage from an IR clone must also strip dependent decorations](../learnings/1793269395038-stripping-linkage-from-an-ir-clone-must-also-strip.md)):

- **`DownstreamModuleExportDecoration`.** The SPIR-V emitter (`slang-emit-spirv.cpp` ~6930) and `collectMetadata` both call `findDecoration<IRExportDecoration>()->getMangledName()`. In the precompile producer (`-embed-downstream-ir`), a clone that has this decoration but no `ExportDecoration` segfaults.
- **`AvailableInDownstreamIRDecoration`.** `removeAvailableInDownstreamModuleDecorations` (`slang-ir-redundancy-removal.cpp`) runs after `legalizeIRForSPIRV`. It removes the body of every function with this decoration and adds `DownstreamModuleImport`, so a clone without an export name crashes in the consumer compile instead.

The helper is shared. lower-buffer-element-type and autodiff call `removeLinkageDecorations` too, so dropping a decoration case from it (on PR #14008 R3, `DownstreamModuleExport`) can bring back crashes in those other callers. A useful probe is a library whose `in` struct param (a `bool` plus a `float3x3` field) is called with both `buf[i]` and a local ([keeping a function alive in a specialization pass](../learnings/1793288517725-keeping-a-function-alive-in-a-specialization-pass-.md)).

## Keep-alive originals: keep few, and visit what you keep (PR #14008)

To make a precompiled blob export the unspecialized signature, PR #14008 kept originals alive. Keeping every `[KeepAlive]` original was too broad: on Metal it crashed on `export` functions with `inout` params with the #11981 "Unknown addressspace" error, on code that compiles on master. Only originals carrying `DownstreamModuleExportDecoration` need to stay, and that decoration exists only for DXIL and SPIR-V ([same](../learnings/1793269395038-stripping-linkage-from-an-ir-clone-must-also-strip.md)).

The kept originals then exposed a reach gap. `processModule` seeds its work list only from entry points, and a callee's body is processed only through its clones, so a kept original keeps a body the pass never saw. Consider an exported function that calls a `[noinline]` helper (or any helper under `-O0`) with a groupshared argument:

```hlsl
groupshared float gSum;
[noinline] void accumulate(inout float s, float x) { s += x; }
export void addTo(inout float x) { accumulate(gSum, x); }
```

The blob then contains `OpFunctionCall %accumulate %gSum`, where a `Function`-storage param receives a `Workgroup` argument. That is ill-typed SPIR-V, and nothing catches it, because `-incomplete-library` skips validation. The fix is to seed every kept function into the work list too; `processFunction` rewrites the calls without retyping the function's own params. The review rule: whenever a change makes a pass keep a function it used to delete, check that the pass also visits that function's body ([same](../learnings/1793288517725-keeping-a-function-alive-in-a-specialization-pass-.md)).

## Widened roots expose latent per-inst bugs (PR #12014)

PR #12014 made `specializeAddressSpace` treat every exported function as a work-list root on Metal (the #11981 fix); before, only entry points and their callees were roots. Review found that this sent bodies the pass had never seen through `processFunction`, and two latent bugs surfaced on programs that master compiled ([seeding new roots into an IR pass exposes latent per-inst bugs](../learnings/1793284788841-seeding-new-roots-into-an-ir-pass-exposes-latent-p.md)):

1. An uncalled `export uint64_t addressOf(int* p) { return bit_cast<uint64_t>(p); }` segfaulted. The `kIROp_BitCast` case copied the operand's address space onto a non-pointer result, and the `Return` case then dereferenced a null pointer type. The fix maps an address space only when `as<IRPtrTypeBase>(inst->getDataType())` is non-null.
2. Clones made inside a seeded root's body were never dead-function candidates, because only the redirected previous callee was added, so they outlived the root's removal. The fix adds every `specializeFunc` clone to the candidates and sweeps to a fixpoint.

When you widen the set of roots a pass visits, probe the new roots with unusual bodies (bitcasts to and from integers, atomics, helper chains, mixed-space calls) and diff the output against a master binary, not only against your own tests.

## Lazily lowered values: `-preserve-params` and byte-address buffers (PR #14045)

The same reach problem appears for values. `legalizeByteAddressBufferOps` creates the `StructuredBuffer` stand-in for a `ByteAddressBuffer` param only when a load, a store, or a `GetEquivalentStructuredBuffer` reaches it. Under `-preserve-params`, DCE's `keepGlobalParamsAlive` keeps every `global_param`, so two kinds of param leak to SPIR-V emit as "Unhandled global inst ... ByteAddressBuffer": params that no op reaches, and the original param of an indexed array. The array original stays "in use" because rewriting the load leaves the dead old `getElement(arr, i)` behind. GLSL shows the same leftover without crashing, as a duplicate declaration at one binding (`usedArray_1[2]`), which makes a good second test signal. Separately, `calcRequiredLoweringPassSet` listed the leaf BAB type ops and missed `RasterizerOrderedByteAddressBuffer`, so a module whose only BAB was an unused ROV BAB skipped the pass entirely; testing `as<IRByteAddressBufferTypeBase>` covers the whole family. Nested `[2][3]` buffer arrays fail spirv-val even for `StructuredBuffer<uint>` on master, which is a separate bug ([-preserve-params exposes lazy translate-on-use IR passes](../learnings/1793301775171-preserve-params-exposes-lazy-translate-on-use-ir-p.md)). How `-preserve-params` interacts with spirv-opt is on [[wiki/concepts/slang-backends-spirv-spirv-opt-and-optimization-levels.md]].

## Testing precompiled modules and cloning passes

- **A failed SPIR-V link is silent.** When linking against a precompiled SPIR-V module fails ("Too many external references", "Unresolved external reference"), slangc prints a SPIRV-TOOLS message, exits 0, and writes no output. Use `TEST:SIMPLE(filecheck)` on `-target spirv-asm` output, not `TEST:COMPILE` ([same](../learnings/1793269395038-stripping-linkage-from-an-ir-clone-must-also-strip.md)).
- **Entry-point names collide across modules.** If the library module has its own entry point, both modules need `-fvk-use-entrypoint-name`; otherwise the link fails with "entry point main already defined" ([same](../learnings/1793269395038-stripping-linkage-from-an-ir-clone-must-also-strip.md)).
- **A cheap A/B corpus run.** Compile every `tests/**/*.slang` with a saved master binary and with the fix, for `-target metal` and `-target wgsl`, with and without `-obfuscate` (`xargs -P 20`, about 15 minutes on 64 cores); `cmp` the outputs and compare exit codes. Only about 60% of the files compile standalone, so report that denominator. On #14008 this caught zero plain-output changes and confirmed the fix ([same](../learnings/1793269395038-stripping-linkage-from-an-ir-clone-must-also-strip.md)).

**Source learnings (5):**
- [-obfuscate: IR clones that keep [export] get the same emitted name](../learnings/1793263779351-obfuscate-ir-clones-that-keep-export-get-the-same-.md) — `generateName` uses the linkage name verbatim under `-obfuscate`; precedent: strip linkage from clones unless one specialization replaces a dead original
- [Stripping linkage from an IR clone must also strip dependent decorations](../learnings/1793269395038-stripping-linkage-from-an-ir-clone-must-also-strip.md) — `DownstreamModuleExport` / `AvailableInDownstreamIR` crashes; keep only DXIL/SPIR-V export originals; silent SPIR-V link failures; A/B corpus recipe
- [Seeding new roots into an IR pass exposes latent per-inst bugs](../learnings/1793284788841-seeding-new-roots-into-an-ir-pass-exposes-latent-p.md) — PR #12014: BitCast address-space copy onto a non-pointer; clones inside seeded roots never swept
- [Keeping a function alive in a specialization pass means visiting its body](../learnings/1793288517725-keeping-a-function-alive-in-a-specialization-pass-.md) — kept originals emit `Function` param ← `Workgroup` arg, unvalidated under `-incomplete-library`; `removeLinkageDecorations` is shared
- [-preserve-params exposes lazy translate-on-use IR passes](../learnings/1793301775171-preserve-params-exposes-lazy-translate-on-use-ir-p.md) — unreached BAB params and array originals leak to SPIR-V emit; ROV BAB missed by `calcRequiredLoweringPassSet` (PR #14045)

_Catalog: [[wiki/index.md]]_
