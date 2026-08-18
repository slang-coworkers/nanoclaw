---
title: "slang #10641 — groupshared array PARAM bug: fix is by-reference lowering, NOT address-space recovery"
type: learning
topic: slang-compiler
source: learnings/1782228568362-slang-10641-groupshared-array-param-bug-fix-is-by-.md
---

# slang #10641 — groupshared array PARAM bug: fix is by-reference lowering, NOT address-space recovery

## Symptom
A `groupshared T scratch[N]` **parameter** produces incorrect DXIL: emitted DXIL has **zero `addrspace(3)`** (no TGSM at all) — the param is lowered to a per-thread `alloca`, barriers synchronize nothing, inter-thread sharing is impossible. Originally reported (slang#10641, 2026.4) as cross-module `[ForceInline]` generic backward-indexing-specific; the **real discriminator is the bare groupshared *parameter*** — generics / `[ForceInline]` / cross-module / index direction are all incidental. At HEAD even a non-generic, non-inline, intra-module groupshared-param case breaks (widened since 2026.4). SPIR-V is correct because it keeps a real `Workgroup`-storage pointer parameter (VariablePointers).

## Triager hypotheses — BOTH wrong on the fix layer
- Approach A: guessed a `GroupSharedRate` drop during serialize/specialize/link round-trip.
- Approach B (recommended): extend the `specializeAddressSpace` recovery pass — which runs for SPIRV/GLSL/Metal/WGSL but **not** HLSL/DXIL (`slang-emit.cpp` ~2278-2290) — to the DXIL path. **This was EMPIRICALLY FALSIFIED by the fixer.**

## Actual root cause + fix (PR #11709)
The bare `groupshared` array parameter was lowered **by value** (an `In` copy) at the parameter boundary, so the callee operated on a per-thread copy. Principled fix is at the **lowering/producer layer**: lower a bare groupshared array param **by reference** (`BorrowInOut`) instead of by-value `In` — scoped via `!InModifier` so explicit `in groupshared` keeps copy semantics — and strip the DXC-illegal `groupshared inout` keyword at HLSL emit (excluding mesh-shader payload params).

## Lessons
1. For "correct on SPIR-V, broken on DXIL" groupshared-**parameter** bugs, the fix layer is **parameter lowering (by-ref vs by-val)**, not the address-space recovery pass. "DXIL lacks the recovery pass" is a true observation but the wrong fix layer — don't anchor a recommendation on it.
2. Verify approach hypotheses empirically before recommending them. The triager's reproduction (matrix of groupshared-param variants) was correct and high-value; the *fix recommendation* was not.
3. **GPU-free dispositive repro for groupshared lowering bugs:** `slangc -target dxil-asm`, then count `addrspace(3)` (TGSM, correct) vs `alloca [N x ...]` + whether `@dx.op.barrier` survives (per-thread, broken). No device needed — "no TGSM exists" is conclusive.
4. Always rebuild before trusting `slangc`: a git checkout/reset does NOT bump mtimes, so ninja silently serves a stale binary even after `git reset --hard`. The stale binary (g5230a81f2) and the HEAD binary disagreed on barrier retention here.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782228568362-slang-10641-groupshared-array-param-bug-fix-is-by-.md`_
