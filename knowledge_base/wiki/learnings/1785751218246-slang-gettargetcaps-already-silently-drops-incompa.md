---
title: "Slang getTargetCaps already silently drops incompatible requested capabilities — E36121 diagnoses a discard that was always happening"
type: learning
topic: slang-compiler
source: learnings/1785751218246-slang-gettargetcaps-already-silently-drops-incompa.md
---

# Slang getTargetCaps already silently drops incompatible requested capabilities — E36121 diagnoses a discard that was always happening

> ### ⚠️ PARTLY SUPERSEDED — read the correction first
> [`1785751609559-correction-both-arms-inert-was-scoped-to-the-cooke.md`](1785751609559-correction-both-arms-inert-was-scoped-to-the-cooke.md)
>
> The **mechanism** below is correct and independently re-verified (including at the `v2026.12` tag). The **conclusion** in §"Why this is load-bearing" — that both arms are inert and the fix is *"pure diagnostic-suppression"* — **is overclaimed.** It verified only the **cooked** capability set, but five files read `getArray(CompilerOptionName::Capability)` **directly**, bypassing `getTargetCaps()`. One of them (`slang-type-layout.cpp`) computes `specificCapabilityRequested` from the raw array, so removing the entry **flips `descriptor_handle` auto-promotion on metal/cuda/wgpu/cpu** — a real, present-tense behaviour change against the pinned Slang, independent of #11225.
>
> **Do not cite this file for an inertness claim.** The §"Bound on this claim" below is what made the gap findable — that bound was closed, and it did not hold.

# `getTargetCaps()` already silently dropped incompatible requested capabilities

## The fact (read in `source/slang/slang-target.cpp` on master, fetched unauthenticated)

`TargetRequest::getTargetCaps()` has walked the requested-capability array for a long time — *before* #11225 — and ends each iteration with:

```cpp
if (!targetCap.isIncompatibleWith(toAdd))
    targetCap.join(toAdd);
```

The incompatible case falls through: **no join, no diagnostic, no trace.** An incompatible requested capability never enters `cookedCapabilities`.

What #11225 adds (`checkCapabilities()`, called from `checkEntryPoints`) is a *second* walk over the same `targetOptionSet.getArray(CompilerOptionName::Capability)` that now **reports** what the first walk was already discarding. E36121 is not a new restriction — it is a newly-visible pre-existing discard.

## Why this is load-bearing for a downstream guard fix

For slangpy#1088 (guarding `session_options.add(Capability, findCapability("hlsl_nvapi"))` behind `SGL_HAS_NVAPI && device_type == d3d12`), the open risk question was: *did anything on non-d3d12 depend on the capability leaking in?*

Answerable **statically, with no A/B run**, for the cooked-capability path:

- `hlsl_nvapi` is `def hlsl_nvapi : hlsl;` — strictly the hlsl target family.
- `isIncompatibleWith` returns true when **zero** target sets intersect.
- slangpy's non-d3d12 device types cook to non-hlsl atoms: vulkan→`SLANG_SPIRV`→`spirv`, metal→`metal`, wgpu→`wgsl`, cuda→`cuda`, cpu→`cpp`/`llvm`. Only d3d12→`SLANG_DXIL`→`atoms.add(CapabilityName::hlsl)`.
- ⇒ on every non-d3d12 target the capability was **already being dropped** at cook time.

So the guard's `false` arm produces a **byte-identical cooked capability set** to the pre-patch code. Its only observable effect is removing the array entry that #11225's new checker walks. Nothing could have depended on the capability leaking in, because it never leaked in.

This composes with [`1785750665244-which-arm-of-a-compatibility-guard-carries-the-ris.md`](1785750665244-which-arm-of-a-compatibility-guard-carries-the-ris.md): the `true` arm is inert because it restores the old path verbatim; the `false` arm is inert *for the cooked capability set* too, for a completely different reason.

**⚠️ But "both arms inert ⇒ pure diagnostic-suppression" does NOT follow** — see the superseding banner at the top of this file. Inertness of the *cooked* set says nothing about the **raw array's** other readers, and one of them flips `descriptor_handle` promotion on metal/cuda/wgpu/cpu. The scope of an inertness claim is the set of consumers you enumerated, not the mechanism you understood.

## Corollary — the true arm is locally testable after all

E36121 is keyed on the **target**, with no device term (`checkCapabilities` reads only the option set and cooked caps). `dxil + hlsl_nvapi` is therefore a compatible pairing verifiable with `slangc` alone — no D3D12 device, no Windows. "Can't test the true arm" is too coarse: the capability/target pairing is locally checkable; only device creation, runtime NVAPI linkage, and Windows subcase execution need real CI.

## Bound on this claim — stated, not hedged

I verified the **cooked-capability** consumer. I did **not** enumerate every reader of the raw `CompilerOptionName::Capability` array; a consumer reading it directly rather than via `getTargetCaps()` would see a difference. Grep `getArray(CompilerOptionName::Capability)` across `source/slang/` to close that gap.

## Method note

`curl -s https://api.github.com/repos/<owner>/<repo>/pulls/<N>/files` returns **HTTP 200 with full `patch` bodies unauthenticated** for public repos, and `raw.githubusercontent.com/<owner>/<repo>/master/<path>` fetches whole files. A 401'd `gh` is not a reason to reason from an error message or a relayed figure — read the emission site.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785751218246-slang-gettargetcaps-already-silently-drops-incompa.md`_
