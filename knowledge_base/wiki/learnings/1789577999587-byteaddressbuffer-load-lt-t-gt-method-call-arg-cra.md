---
title: "ByteAddressBuffer.Load&lt;T&gt;() + method/call-arg crash = specialization dropping the alignment operand"
type: learning
topic: ci-tooling
source: learnings/1789577999587-byteaddressbuffer-load-lt-t-gt-method-call-arg-cra.md
---

# ByteAddressBuffer.Load&lt;T&gt;() + method/call-arg crash = specialization dropping the alignment operand

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789562643352-erls9c
written_at: 2026-09-16T16:59:59.587Z
---

# ByteAddressBuffer.Load&lt;T&gt;() + method/call-arg crash = specialization dropping the alignment operand

**Symptom:** `slangc` SIGSEGVs (all targets, GPU-free) compiling e.g. `input.Load<S>(0).get()` where `S { float values[5]; float get(){...} }` and `input` is a `ByteAddressBuffer`. Crash needs BOTH a struct big enough to specialize AND the loaded value passed into a call (method `this` counts); a direct field access `.values[0]` or a smaller struct compiles clean. (shader-slang/slang#13126, PR #13130.)

**Root cause pattern:** `byteAddressBufferLoad` is a **3-operand** IR op `(buffer, offset, alignment)` — `slang-ir-insts.lua:1322-1328`; the front end always emits 3 (`Load`→alignment literal 0, `LoadAligned`→stride). But `specializeFuncsForBufferLoadArgs` → `getSpecializedValueForArg` in `slang-ir-specialize-function-call.cpp` (~:911-913, mirror :933-935) rebuilds element/field-access insts with a **hardcoded operand count of 2**, silently dropping the alignment operand. Then `slang-ir-byte-address-legalize.cpp` `processLoad` (~:140) unconditionally reads `getOperand(2)` → out-of-bounds `IRUse` → `validateExplicitAlignment` derefs the wild `IRInst*` via `as<IRIntLit>(...)->getOp()` BEFORE its `SLANG_RELEASE_ASSERT` → SIGSEGV in Release (Debug surfaces `slang-ir.h:711 index < getOperandCount()`).

**Discriminator (why array-size matters):** `isTypePreferrableToDeferLoad` (`slang-ir-defer-buffer-load.cpp`) gates specialization — a composite containing arrays >16 bytes (`{float[5]}`=20B) qualifies; `{float[4]}`=16B fails the min-threshold and is never specialized, so the operand is never dropped.

**Fix that stuck:** producer-side — copy ALL trailing operands via `oldArg->getOperandCount()` in the specialization rebuild (also key the specialization cache on trailing operands, else a source-order-dependent `LoadAligned` miscompile). PLUS a loud `SLANG_RELEASE_ASSERT(operandCount==3)` at the legalizer, NOT a tolerant guard — the legalizer's own 2-operand loads at `:999` are terminal leaf output never re-fed through `processLoad`, so the input contract there is exactly 3 ⇒ assert-not-mask per repo methodology. Confirmed regression: #8547 introduced the drop, #11595's explicit-alignment check turned it fatal.

**Triage takeaway:** for any "buffer `Load<T>`/`Store<T>` + method or call-arg → crash", suspect a specialization/clone pass dropping a trailing operand of a multi-operand load inst; verify operand counts with `-dump-ir-after specializeFuncsForBufferLoadArgs`. DeepWiki wrongly claimed the load has no alignment operand — source (lua def + hlsl.meta.slang Load<T>) is authoritative.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789577999587-byteaddressbuffer-load-lt-t-gt-method-call-arg-cra.md`_
