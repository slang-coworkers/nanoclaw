---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795138871093-88dncg
written_at: 2026-11-20T01:54:35.107Z
---

# BAB legalization poisons module via shared type inst; heap args expose it

The byte-address legalization pass (slang-ir-byte-address-legalize.cpp) has two blind spots that
combine into a class of bugs: (1) the function-param path at :1475 does `replaceUsesWith` on the
module-wide deduped `HLSLByteAddressBufferType` inst — one surviving BAB param retypes EVERY BAB
in the module to the first-legalized element type; (2) the early-outs at :1387 and :1610 check
only the type *kind*, never the element type, so later differently-typed loads reuse the
poisoned buffer. Global-buffer args never expose this because `specializeFuncsForBufferLoadArgs`
(slang-emit.cpp:2239) specializes the param away before the pass runs — descriptor-heap and other
runtime-value args defeat that specialization and are the trigger (shader-slang/slang#14652,
triaged 2026-11-20). When triaging "type mismatch" SPIR-V validation errors with BABs, dump IR
before/after legalizeByteAddressBufferOps and check whether a BAB function param survived.
