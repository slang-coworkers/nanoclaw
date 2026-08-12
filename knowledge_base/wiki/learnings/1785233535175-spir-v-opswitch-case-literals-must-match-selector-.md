---
title: "SPIR-V OpSwitch case literals must match selector word-count (fix #12240) + delivery-gate needs all 3 codex stages"
type: learning
topic: agent-ops
source: learnings/1785233535175-spir-v-opswitch-case-literals-must-match-selector-.md
---

# SPIR-V OpSwitch case literals must match selector word-count (fix #12240) + delivery-gate needs all 3 codex stages

## Two lessons from slang#12240 (64-bit switch → invalid OpSwitch in SPIR-V)

### 1. The bug/fix (emit-layer, reusable pattern)
`slangc -target spirv` on a `uint64_t`/`int64_t` switch selector produced an **invalid OpSwitch**: SPIR-V validation failed with "End of input reached while decoding OpSwitch ... expected more operands". Root cause was `SPIRVEmitContext::emitLocalInst`'s `case kIROp_Switch:` in `source/slang/slang-emit-spirv.cpp` — it emitted each case literal as a single 32-bit word (`emitOperand((SpvWord)intLit->getValue())`) regardless of selector width.

**SPIR-V rule:** each OpSwitch case `literal` must occupy the same word count as the **selector** type. A 64-bit selector needs a two-word literal per case.

**Fix (Approach A):** query selector width once via `getIntTypeInfo(m_targetRequest, switchInst->getCondition()->getDataType())`, then `emitOperand(SpvLiteralInteger::from64((int64_t)v))` (2 words) when `width > 32` else `from32((int32_t)v)`. `emitOperand(const SpvLiteralInteger&)` already loops the words. The 32-bit path is bit-identical to the old cast. This mirrors the width split `emitIntConstant` already applies (via `SpvLiteralBits::from64/from32`). The IR producer (`lowerSwitchCases`) is already correct — pure emit-side encoding bug, so the fix belongs at emit.

**Test harness (no GPU):** `-target spirv-asm` FileCheck test — the spirv-tools disassembler fails to decode the truncated OpSwitch at HEAD and succeeds after the fix. Note: **spirv-dis prints a signed 64-bit case literal as signed decimal** (e.g. `-4294967301`), not the unsigned two's-complement form — match your CHECK line to the signed decimal. Case values must exceed 2^32 to distinguish a correct two-word literal from a truncated/narrowed one.

Distinct roots from sibling switch bugs: #12237 (bool selector → IRBoolLit, legalize layer), #12238 (float switch, front-end reject), #12236/#9999 (missing diagnostics). Don't fold.

### 2. Delivery-gate mechanics (critique-gate overlay)
`gh pr create` (and other delivery markers) is **denied by the critique-gate hook until ALL required codex stages are recorded as a round**: PLAN_REVIEW **and** CODE_REVIEW **and** OUTPUT_REVIEW, with OUTPUT_REVIEW's final verdict = approve. Running only CODE_REVIEW is not enough — the gate names the missing stages. Run `/codex-critique` once per stage, using the canonical developer-instructions block **verbatim** (the hook checks sentinel lines; a rewritten block does not count toward the gate).

Codex is notably strict on **test-file comment hygiene**: it flagged "Previously… single 32-bit word… truncated" (change-history narration) and a "Regression test for …" opener as must-fix. Keep test comments to enduring rationale (the invariant + why the coverage exists); put the issue link as a trailing "See <url>" reference, not a "Regression test for" header.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785233535175-spir-v-opswitch-case-literals-must-match-selector-.md`_
