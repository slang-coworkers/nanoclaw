---
title: "slang#12186 option-a: layout change RESTORES cap-consistency; module-scope handle const from float/bitcast hits pre-existing global-emit gap"
type: learning
topic: slang-compiler
source: learnings/1784912194039-slang-12186-option-a-layout-change-restores-cap-co.md
---

# slang#12186 option-a: layout change RESTORES cap-consistency; module-scope handle const from float/bitcast hits pre-existing global-emit gap

Investigating pdeayton's two concerns on the DescriptorHandle option-a rework (kind-dependent uint64/uint2 under spvBindlessTextureNV). Two durable, non-obvious findings — both from A/B-ing the PR binary against master:

## 1. "Does the conversion assert?" — separate PRE-EXISTING gap from PR-introduced sharp edge
- A module-scope `static const` handle initialized from a FLOAT (`uint2(float2(...))`) or `bit_cast` source aborts. But the SAME `castFloatToInt` "Unhandled global inst in spirv-emit" reproduces IDENTICALLY on master with NO capability and NO handle (`static const uint2 = uint2(float2(...))`). So it's a general emitGlobalInst gap, NOT the PR's fault. The A/B against master (no-cap, no-handle control) is what proves this — always run it before blaming a PR for an abort.
- The genuinely-new edge: on the WIDTH-MISMATCH path (uint64 texture handle built from a uint2/float source), the PR's `tryGetConstantDescriptorHandleBits` emit-walker has no CastFloatToInt/FloatCast/BitCast case → returns null → `SLANG_RELEASE_ASSERT(converted)` at slang-emit-spirv.cpp:2855 fires where master gave a softer "unimplemented". Function-LOCAL uses work (runtime path emits OpConvertFToU/OpBitcast in a block); only module-scope constants fail.
- Principled layer = SCCP (canonical const evaluator): it runs at global scope in spirv-legalize BEFORE emit (slang-ir-spirv-legalize.cpp:3104), and isEvaluableOpCode (slang-ir-sccp.cpp:113) already folds BitCast/CastFloatToInt/FloatCast/IntCast/Select — but NOT MakeVector/MakeVectorFromScalar nor the 4 Cast*DescriptorHandle ops. That's exactly why the inner castFloatToInt survives to emit. Teaching SCCP those ops retires both the bespoke walker AND the assert.

## 2. "uint2 giving scalar layout — latent bug?" — NO; it RESTORES consistency
- std430/std140/cbuffer: PR == master (uint2 has std430 align 8, same as uint64 — no observable diff). The divergence is only under SCALAR/natural layout (-fvk-use-scalar-layout): buffer handle align 4 (uint2) on PR vs 8 (uint64) on master.
- DECISIVE test: under PLAIN spirv (no bindless cap), a buffer handle is ALREADY uint2@align-4 on BOTH binaries. So on master, turning ON the cap silently flipped buffer-handle layout uint2→uint64. The PR makes it uint2 regardless of cap = matches the default path. The old uniform-uint64 was the anomaly; "scalar layout" is correct.
- Verified emit ↔ reflection(-reflection-json) ↔ sizeof/alignof all AGREE across all 6 kinds incl. SamplerComparisonState (AST `as<SamplerStateType>` and IR `as<IRSamplerStateTypeBase>` don't diverge). Both layouts pass spirv-val.
- Still worth flagging to maintainer as a conscious ABI sign-off: structs embedding a buffer/AS-kind handle under scalar layout now pack at 4-byte align (was 8) → can shift host↔device struct offsets. Correct-by-rules, but a real layout change.

Technique: `-reflection-json <f>` exposes the AST-layout side; grep `OpMemberDecorate %X Offset` for the IR-emit side; comparing the two catches AST/IR classifier divergence. `-o /dev/null` errors on some debug builds → emit to spirv-asm stdout instead. FileCheck absent locally → PR tests show "ignored", verify by running slangc directly.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784912194039-slang-12186-option-a-layout-change-restores-cap-co.md`_
