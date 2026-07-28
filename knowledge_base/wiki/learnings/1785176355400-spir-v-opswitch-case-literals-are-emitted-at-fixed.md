---
title: "SPIR-V OpSwitch case literals are emitted at fixed 32-bit width (breaks 64-bit selectors)"
type: learning
topic: slang-compiler
source: learnings/1785176355400-spir-v-opswitch-case-literals-are-emitted-at-fixed.md
---

# SPIR-V OpSwitch case literals are emitted at fixed 32-bit width (breaks 64-bit selectors)

**shader-slang/slang#12240** — `slangc -target spirv` emits an invalid `OpSwitch` when the switch selector is a 64-bit integer (`uint64_t`/`int64_t`). SPIR-V validation fails with *"End of input reached while decoding OpSwitch ... expected more operands after N words"*.

**Root cause (emit-layer, NOT IR/front-end):** `source/slang/slang-emit-spirv.cpp`, `case kIROp_Switch:` in `SPIRVEmitContext::emitLocalInst` (~line 5436). Each case literal is written as a single 32-bit word:
```cpp
emitOperand((SpvWord)intLit->getValue());   // one word, always 32-bit
```
`SpvWord` is 32-bit (`SLANG_COMPILE_TIME_ASSERT(sizeof(SpvWord)==4)`), and `emitOperand(SpvWord)` pushes exactly one word. Per the SPIR-V spec, an `OpSwitch` literal must occupy the **same number of words as the selector type** — a 64-bit selector needs 2 words per case. Emitting one word leaves the instruction short of its declared word count → truncated binary → validation fails. It also silently drops the case value's upper 32 bits.

**The IR is correct** — `lowerSwitchCases` (slang-lower-to-ir.cpp) builds case values at their real type (i64), so the producer is fine; the fix belongs at emit.

**Width-aware model to mirror (already in the same file):** `emitIntConstant` (~1177) switches on `type->getOp()`: `kIROp_Int64Type`/`kIROp_UInt64Type` → `SpvLiteralBits::from64(...)` (2 words), else `from32` (1 word). `SpvLiteralInteger::from64(v)` = `{SpvWord(v), SpvWord(v>>32)}`; `emitOperand(const SpvLiteralInteger&)` already loops and emits the right word count. Canonical width query: `getIntTypeInfo(m_targetRequest, IRType*).width` (slang-ir.h/.cpp; used at ~2442 for OpTypeInt). Cleanest fix computes `ceil(width/32)` words generally rather than a 32-vs-64 branch.

**Verify without GPU:** `-target spirv` + `SLANG_RUN_SPIRV_VALIDATION=1` exercises the OpSwitch encoding at compile time. Control: identical shape with a 32-bit `uint` selector compiles clean (EXIT 0), 64-bit fails (EXIT 255) — isolates the bug to selector width > 32.

**Dedup note:** part of skiminki-nv's switch-codegen sweep but a DISTINCT root from siblings — #12237 (bool → `processSwitch` normalization in slang-ir-spirv-legalize.cpp), #12238 (float selector → `visitSwitchStmt` `TODO(tfoley)` in slang-check-stmt.cpp), #12236/#9999 (missing diagnostics). One fix does not cover multiple; these are separate layers.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785176355400-spir-v-opswitch-case-literals-are-emitted-at-fixed.md`_
