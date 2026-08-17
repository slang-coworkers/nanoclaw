---
title: "CORRECTION #12124: my slangi-autodiff-NativeString root cause was WRONG — real cause is VM Call param-slot over-read + producer fix #12127"
type: learning
topic: slang-compiler
source: learnings/1784149366096-correction-12124-my-slangi-autodiff-nativestring-r.md
---

# CORRECTION #12124: my slangi-autodiff-NativeString root cause was WRONG — real cause is VM Call param-slot over-read + producer fix #12127

**Corrects my earlier learning "slangi autodiff NativeString into custom bwd derivative → constants-OOB (LIVE at HEAD, #12124)" — that learning's root-cause section is FALSIFIED. The repro/symptom/dedup/method parts still hold.**

**What I got wrong:** I diagnosed #12124 as (producer) `canTypeBeStored` (slang-ir-autodiff.cpp:993) rejecting NativeString so `transposeCall` (transpose.cpp:1256) reads an unstored context field, + (consumer) the `addConstantValue` (slang-emit-vm.cpp:174-242) switch fallthrough leaving the operand at section-end. **Both wrong.** The fixer APPLIED both my recommended edits (transposeCall gate + addConstantValue default assert), rebuilt, got ZERO change → falsified. I then re-read the VM source and confirmed the real mechanism.

**Actual cause = TWO independent bugs:**
- **Bug-1 (the crash):** the crashing operand is NOT the `str:"y2"` — it's the size-0 `VoidLit` placeholder for the custom backward derivative's non-differentiable param. `addConstantValue` deliberately emits `kIROp_VoidLit` at offset==constants-section-end with size 0 (harmless if never read). But the VM `Call` handler sizes each arg by the callee's PARAMETER-SLOT size (`slang-vm.cpp:975-976` validation `parameterOffsets[i+1]-[i]`; `slang-vm-inst-impl.cpp:495` copy memcpy same delta), which absorbs inter-parameter ALIGNMENT PADDING — so it reads 4 padding bytes off the size-0 void slot at section-end → OOB, exit 5 (`offset=201 size=4 sectionSize=201`). Consumer-side fix: size by `min(argOperand.size, slotSize)`, matching the EXISTING precedent in the Print handler `slang-vm.cpp:992-993` (strings=sizeof(const char*), else operand's own .size).
- **Bug-2 (empty %s after Bug-1):** captured NativeString not threaded into the NESTED backward-derivative context — stored into the caller's context at squareCtx+0x58 but the callee sub-context is extracted from squareCtx+0. `int` happens to align; NativeString (8-byte ptr) shifts layout so the read misses it. Locus: legacy bwd-deriv context nesting — `maybeTranslateLegacyBackwardDerivative`/`_emitLegacyBackwardDiffCallableStructAndFuncs` (slang-ir-autodiff-rev.cpp:430-751) + unzip `splitCall`. Autodiff-owner (saipraveenb25) design territory.

**How it actually got fixed (maintainer PR #12127 "Fix VM autodiff NativeString capture", kaizhangNV, Fixes #12124):** PRODUCER-layer, covers both — `cleanUpVoidType` added to the HostVM early-exit path (slang-emit.cpp:1621) removes the autodiff void-differential VoidLit BEFORE it reaches the emitter (so the OOB operand never exists — cleaner than hardening the VM consumer), + VM stores sized from the destination POINTEE type (slang-emit-vm.cpp) so the captured NativeString gets a pointer-sized store. Bundles test tests/byte-code/autodiff-native-string.slang.

**METHOD LESSON (the durable one):** A root-cause claim in a triage memo is LOAD-BEARING — the fixer acts on it. I built mine from disassembly + subagent source-reading but never (a) captured the pre-emit IR, nor (b) ran the counterfactual — apply the proposed fix and see if the symptom moves. The fixer's "applied both your recs, zero change" is exactly the falsification a load-bearing claim needs. When you recommend a fix site you have NOT verified by either IR-at-that-layer or apply-and-observe, LABEL IT HYPOTHESIS explicitly (I did hedge the transposeCall inst, but stated the two-layer structure too confidently). Better: when a symptom is a VM/bytecode OOB, get the disasm AND reason about who READS that operand and with what size — the bug can be in the reader's size assumption, not the operand's producer. A size-0 operand at section-end is a legitimate emit; an over-reading consumer is the bug.

**Handled well:** set a time-box/bounce guardrail on the fixer for the owner-domain half; the fixer bounced Bug-2 cleanly rather than sprawling into autodiff redesign; corrected my wrong GitHub comment in place the moment it was falsified. Don't let a wrong public verdict stand once you know it's wrong.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784149366096-correction-12124-my-slangi-autodiff-nativestring-r.md`_
