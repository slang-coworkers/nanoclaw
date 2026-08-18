---
title: "#11917 gating: legalize passes keyed on TYPE SHAPE (IntLit dims) are B/C-risky — in-window any-value marshalling synthesizes 1-vectors"
type: learning
topic: misc
source: learnings/1783995257092-11917-gating-legalize-passes-keyed-on-type-shape-i.md
---

# #11917 gating: legalize passes keyed on TYPE SHAPE (IntLit dims) are B/C-risky — in-window any-value marshalling synthesizes 1-vectors

**Context:** #11917 backend-pass gating (RequiredLoweringPassSet flags to skip no-op module walks). Family (b) = `legalizeEmptyArray` / `legalizeVectorTypes` / `legalizeUniformBufferLoad`. All three determined **B/C-risky (no naive gate)** at HEAD a9c6ff78e4.

**Key hazard — `legalizeVectorTypes` (CONFIRMED in-window 1-vector synthesis):** `generateAnyValueMarshallingFunctions` (slang-emit.cpp:1584, in-window between the :1452 calc scan and legalizeVectorTypes@:1706) creates `getVectorType(uint, numUints)` where `numUints = (size + 3) / 4` (slang-ir-any-value-marshalling.cpp:592/:1003). A single 4-byte field → numUints==1 → a genuine **1-vector**. `IRBuilder::getVectorType` (slang-ir.cpp:2998) does NOT collapse count==1 to scalar. So a flag frozen at :1452 is stale-FALSE and the gate wrongly skips → un-legalized 1-vector reaches emit. NOTE: only the sibling `numFieldsNeeded` path (:665) is guarded `==2||==4`; the `numUints` paths are unguarded — easy to miss.

**General rule for #11917 gating:** a pass whose trigger is a TYPE SHAPE (`IRArrayType`/`IRVectorType` with a specific `IRIntLit` dimension, or `IRLoad`-of-`IRConstantBufferType`) rather than a distinct opcode is inherently hard to gate with a `RequiredLoweringPassSet` bool — the bool can't express "count==0/1" without replicating the scan, and dimension-bearing types are readily synthesized by in-window type-transformers (any-value marshalling, coopvec lowering `getArrayType(elem, coopVecLen)` @slang-ir-lower-coopvec.cpp:51, tuple/existential lowering, inline/simplify). Default these to B/C-risky unless you can EXHAUSTIVELY prove no in-window producer. Safe-to-gate passes key on front-end-only OPCODES never synthesized post-scan (the merged #11920 lowerAppendConsumeStructuredBuffers / #11961 lowerTaggedUnionTypes template).

**Process:** do NOT trust an Explore subagent's "A-safe" verdict on gating — one reported all of family (b) A-safe (asserted any-value "creates size≥2 only", missing the unguarded numUints==1). A wrong A-safe ships a miscompile; independently verify every producer claim in source before shipping a gate. Green CI ≠ safety proof (the synthesized-shape input may not be in any local test).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783995257092-11917-gating-legalize-passes-keyed-on-type-shape-i.md`_
