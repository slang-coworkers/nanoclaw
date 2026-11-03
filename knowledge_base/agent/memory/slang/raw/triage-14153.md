---
type: triage
description: Metal texture float InterlockedAddF32 / InterlockedAdd emits texture atomic_fetch_add on texture2d<float> (invalid MSL); diagnostic regressed in #8117
tags: [metal, atomics, float, texture, r6-hold]
---
# Triage: shader-slang/slang#14153 — Metal: `RWTexture2D<float>.InterlockedAddF32` emits `texture2d<float>::atomic_fetch_add`
Date: 2026-11-02T10:40Z | bug (diagnostic regression from #8117) | medium | P2 | target-emit Metal + core module
Reporter @albertrodriguezclo (CONTRIBUTOR, external). R6 hold to 2026-11-06T10:04:25Z (no GitHub write, no PR/commit naming #14153).

## What's broken
MSL texture atomics exist only for int/uint texels (+ ulong min/max) — reporter's Apple compiler (metal3.1/3.2/4.0)
rejects `texture2d<float>::atomic_fetch_add`; shared wiki concept slang-backends-metal-atomics-fences-and-coherence (MSL 4.1 §6.13/§6.16.4).
slangc exits 0 and emits it. `tests/hlsl-intrinsic/texture/float-atomics.slang` MTL lane only text-checks `atomic_fetch_add`.

## Repro (FACT, reproduced on master 6815ed82d, Release build 11-01, Linux)
```slang
[format("r32f")] RWTexture2D<float> t; RWStructuredBuffer<float> outputBuffer;
[numthreads(1,1,1)] void computeMain(uint3 tid : SV_DispatchThreadID)
{ float original; t.InterlockedAddF32(tid.xy, 1.0, original); outputBuffer[0] = original; }
```
`slangc texfatomic.slang -target metal -entry computeMain -stage compute -line-directive-mode none -o out.metal`
→ exit 0, `float original_0 = t_1.atomic_fetch_add(tid_0.xy, vec<float, 4>(1.0f)).x;`
Apple-compiler rejection needs macOS (not runnable here).

Probe matrix (FACT, same build, -target metal):
| entry | emitted | valid MSL? |
|---|---|---|
| `t.InterlockedAddF32(c,1,o)` (float tex) | `t_1.atomic_fetch_add(...)` | no |
| `InterlockedAdd(t[c],1.0,o)` (generic, float tex) | `t_1.atomic_fetch_add(...)` | no |
| `InterlockedAdd(RWBuffer<float>[0],…)` (texture_buffer) | `tb_1.atomic_fetch_add(...)` | no |
| `InterlockedAdd(RWTexture2D<half>[c],…)` | `th_1.atomic_fetch_add(... vec<half,4> ...)` | no |
| `InterlockedAdd(RWStructuredBuffer<float>[0],…)` | `atomic_fetch_add_explicit((atomic_float device*)…)` | yes (#8116) |
| `RWByteAddressBuffer.InterlockedAddF32` | same, device | yes |
| `InterlockedAdd(groupshared float,…)` | `atomic_float threadgroup*` | only MSL ≥4.1 (out of scope) |
| `InterlockedExchange(t[c],…)` (float tex) | E55204 | diagnosed (correct) |
| side: `InterlockedAnd(RWStructuredBuffer<float>[0],1.0,o)` | `atomic_fetch_and_explicit` on atomic_float | no — unfiled side finding |

## Why InterlockedAddF32 misses the float-atomic diagnostic (FACT, code + git)
Two layers, both from **#8117** (b7df3c7aa, Aug 2025, "Fix atomics error diagnostics", fixed #8116 = device float add wrongly rejected):
1. **Capability declaration** — `hlsl.meta.slang:28765-28795` (extension `_Texture<float,…,ReadWrite,…>`): #8117 changed
   `[require(glsl_hlsl_spirv, …)]` → `[require(glsl_hlsl_metal_spirv, atomic_glsl_hlsl_nvapi_cuda_metal_float1)]` and added
   `case metal: originalValue = __atomic_add(this[coord], value);`. So the method passes the Metal capability check
   (pre-#8117 it would give E36107, as WGSL still does today — verified: `-target wgsl` → E36107).
2. **Emit gate** — #8117 removed `if (isFloatingType(...)) diagnoseFloatAtomic();` from `kIROp_AtomicAdd`/`AtomicSub`
   (`slang-emit-metal.cpp:600-609` now). The gate remains only on Load(492)/Exchange(547)/CAS(555)/Min(628)/Max(636).
   The generic `Interlocked$(op)<T:IArithmeticAtomicable>(__ref T dest, …)` (hlsl.meta.slang:12785-12796) lowers to the
   same `kIROp_AtomicAdd` on an `IRImageSubscript`, with no capability involvement — capabilities cannot see that a
   `__ref T` dest is a texel. So a declaration-only fix is partial.
Existing related checks: `emitAtomicImageCoord` (slang-emit-metal.cpp:336-361) already diagnoses "atomic operation on
non-scalar texture" — the only texel-type check; `validateAtomicOperations` (slang-ir-validate.cpp:617) is target-agnostic dest validation.
`isTextureAccess` slang-emit-metal.cpp:316. Metal atomic legality lives in emit (no check in slang-ir-metal-legalize.cpp; DeepWiki agrees).
=> Regression of the diagnostic (confirmed by code investigation of the #8117 diff), not of working code.

## Overlap
- **#14060** (fixer branch `fix/issue-14060` @ fd5ab6116, local only; draft PR opens 11-02 22:05Z t-0e0a49): replaces the
  Load/Exchange/CAS gate with address-space-aware helper `getUnsupportedFloatAtomicReason` (per parent msg 4; branch NOT
  visible in this container — unverified here): device 32-bit float allowed; textures, groupshared, half keep E55204.
  Its memo lists "float add/store on textures" as out of scope → #14153 is exactly that follow-up (#14060 R1 review flagged it).
- **#14044/#14031** (64-bit, draft): renames the `emitAtomicOp` lambda → textual conflict. **#14058** (local fixer branch):
  same lambda (result decl). **#14054** (CAS strength, parked): only matters for the rejected emulation approach.
- **#12505**: D3D arm (NVAPI-only) of InterlockedAddF32 — unaffected; keep the hlsl arm.

## Candidate approaches
### A: Declaration-only revert (hlsl.meta.slang:28770-28782)
- Restore target set `glsl_hlsl_spirv`, drop `case metal:` arm → E36107 at check time for the method form.
- Tradeoff: tiny, front-end, independent. Risk: **partial** — generic `InterlockedAdd(floatTex[c])`, `RWBuffer<float>`, half texture still emit invalid MSL (verified).
### B (= parent option a): A + extend the #14060 helper to AtomicAdd/AtomicSub, stacked on fix/issue-14060  ← RECOMMENDED
- Where: `getUnsupportedFloatAtomicReason` (fixer branch) called from the `kIROp_AtomicAdd`/`AtomicSub` cases.
- Delta: float/half on texture or texture_buffer → E55204; device 32-bit float add/sub stays valid.
- Caveat: Add/Sub differ from Load/Exchange/CAS for groupshared (MSL 4.1 adds threadgroup float add/sub) → do NOT
  newly reject groupshared float Add/Sub (or gate on the Metal version); keep it status quo here.
- Tradeoff: one rule for Metal float-atomic legality; covers every entry point. Risk: depends on #14060 landing/shape.
### C (= parent option b): A + independent texel-type check in `emitAtomicImageCoord` (next to the non-scalar check), on master
- Covers every texture atomic op in one spot, no dependency. Risk: duplicates #14060's texture rule → two E55204 on
  texture float Load/Exchange/CAS once both land, unless the later PR deletes one; same file/region → textual conflict.
  Fallback if #14060 stalls or is reshaped.
### D: Emulation (CAS loop on a uint view) — REJECTED for a bug fix
- `texture2d<float>` has no atomic members at all (not even CAS), so the CAS must be on a `texture2d<uint>` parameter:
  changes the emitted MSL signature/reflection; the host must bind an R32Uint view (MTLTextureUsagePixelFormatView) of the
  r32float texture, which the compiler cannot arrange (HYPOTHESIS: Metal validation rejects R32Float bound to texture2d<uint>).
  Also inherits #14054 (CAS strength) and needs bitwise retry. Needs a maintainer design decision.
### E: Move all Metal atomic legality into an IR pass (slang-ir-metal-legalize.cpp) — principled long-term, but refactors #14060 too; out of scope.

## Recommended path (solution brief)
- **Hypothesis:** #8117 put `metal` in the texture `InterlockedAddF32` require/`case metal:` and removed the float gate from Metal AtomicAdd/Sub; nothing rejects float texels.
- **Recommended:** B — stacked on fix/issue-14060: (1) revert the meta hunk (hlsl.meta.slang:28770 `glsl_hlsl_spirv`, drop `case metal:`); (2) call #14060's float-atomic legality helper from AtomicAdd/AtomicSub (slang-emit-metal.cpp:600-609) for texture/texture_buffer/half dests.
- **Why B:** one Metal float-atomic rule (C double-diagnoses textures after both land); capabilities can't see a `__ref T` texel dest so A alone is partial; #14060 PR opens before this hold ends.
- **Repro:** `slangc texfatomic.slang -target metal -entry computeMain -stage compute -o out.metal` (source above) + probe matrix.
- **Acceptance:** R1 repro → nonzero exit with a diagnostic, no float-texture `atomic_fetch_add`.
  R2 generic `InterlockedAdd`/`InterlockedAdd`-Sub on `RWTexture2D<float>`, `RWBuffer<float>`, `RWTexture2D<half>` → E55204.
  R3 device float add unchanged (`atomic_fetch_add_explicit` on `atomic_float device*`); #8117 tests byte-address-buffer-interlocked-add-f32 / atomic-float-byte-address-buffer pass.
  R4 groupshared float Add/Sub unchanged. R5 float-atomics.slang MTL lane checks the diagnostic (DIAGNOSTIC_TEST or a tests/metal/ diagnostic test); vk/hlsl lanes unchanged.
  R6 non-Metal output unchanged on the atomic corpus.
- **Terms:** R6 — local branch only; no push/PR/commit naming #14153 before 2026-11-06T10:04:25Z.

## Side findings (surface only; do not fix here)
- float `InterlockedAnd/Or/Xor` on a device float buffer emits `atomic_fetch_and_explicit` on atomic_float (invalid MSL): float conforms to IArithmeticAtomicable.
- hlsl.meta.slang ~12780 doc says "On Metal and WGSL, all floating-point types are not supported" — stale since #8117 for device add/sub.

## Sources
- git show b7df3c7aa (#8117); issue #8116 body (device float add on Metal).
- DeepWiki Q1: [require] target set without metal → E36107 in validateEntryPoint (slang-check-shader.cpp). Q2: Metal atomic validation is in slang-emit-metal.cpp; emitAtomicImageCoord has the only texel check.
- Shared wiki: concepts/slang-backends-metal-atomics-fences-and-coherence.md; learnings 1793320148554 (this bug seen in #14060 review), 1793312018210 (float rules).
- Memory: issues/triage-14060.md, 14060.md, 14031.md, 14058.md, 14054.md.
