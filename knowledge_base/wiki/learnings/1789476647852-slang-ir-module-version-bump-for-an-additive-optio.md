---
title: "Slang IR module-version bump for an additive optional operand — backward-compat facts"
type: learning
topic: slang-compiler
source: learnings/1789476647852-slang-ir-module-version-bump-for-an-additive-optio.md
---

# Slang IR module-version bump for an additive optional operand — backward-compat facts

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786701797724-j3vwpf
written_at: 2026-09-15T12:50:47.852Z
---

# Slang IR module-version bump for an additive optional operand — backward-compat facts

When adding an **optional operand** to an existing Slang IR instruction (e.g. the conformance-identity operand on `IRWitnessTable` in slang#12540/PR#12567), the backward-compatibility story a maintainer will ask about is answerable from the serialization code, and the version bump is **max-only**:

- **Bump `k_maxSupportedModuleVersion` only** (28→29), leave `k_minSupportedModuleVersion` (4). `docs/design/ir-instruction-definition.md` classifies "adding new optional operands" as a *minor* (max-only) bump; "modifying minimum operand counts/types" or removing/changing semantics is a *major* (both) bump.
- **IR serialization is self-describing for operand counts.** `source/slang/slang-serialize-ir.cpp`: `struct InstAllocInfo { IROp op; uint32_t operandCount; }` (~L56-62) is written per-inst (~L468); on read the inst is allocated with the *stored* count (~L587) and the operand-fill loop runs `for (o < inst->operandCount)` (~L613-614). So an instruction serialized by an older compiler comes back with its original operand count — an old (1-operand) witness table reads back as `operandCount==1`; the new optional operand is never fabricated.
- **The load path does NOT gate on the module *semantic* version.** Only the serialization *format* version is hard-checked (`slang-serialize-ir.cpp` ~L813 vs `kSupportedSerializationVersion`). `k_min/k_maxSupportedModuleVersion` are NOT consulted for load-time rejection — they're used for module stamping (`k_maxSupportedModuleVersion` initializes `IRModule::m_version`) and `-get-supported-module-versions` reporting. (Note: `docs/design/backwards-compat-for-ir-modules.md` claims a "version out of range → fail" check that is NOT actually implemented — a doc/impl discrepancy.)
- **Make the accessor guard on operand count**: `getOperandCount() > 1 ? getOperand(1) : nullptr` — so old modules safely return null, no read past the count. Audit every call site to null-guard, and confirm no code indexes the new operand directly.
- **Test-coverage reality:** there is NO cross-version (old-module → new-reader) load test in the repo; only same-version serialize/deserialize round-trips (`tools/slang-unit-test/unit-test-ir-blob.cpp`, `tests/serialization/*`). A true old-version fixture is producible (a prior-version build emits it) but maintaining a compiler-generated binary fixture has cost. Disclose this honestly rather than claiming a test exists.
- **One real subtlety to flag:** because `IRInstKey` compares operand counts, a legacy identity-less table (1 operand, from an old serialized module) and a freshly-lowered identity-bearing table (2 operands) for the *same* conformance will NOT GVN-merge — they still share the export/linkage name, but the semantic impact across clone/link paths is untested. Don't assert it's "benign"; flag it for a serialization maintainer.

Meta: when a maintainer asks a pointed compatibility question, delegate the "how does X actually behave in the serializer" dig to a subagent (keeps context clean), then answer with file:line and be explicit about what is proven-by-construction vs untested. codex OUTPUT_REVIEW will (correctly) reject any "still merges everywhere" / "benign" / "min-version causes old modules to load" overstatement — scope every dedup claim to identity-bearing tables and describe the loader's actual acceptance mechanism (format version + recognized opcodes + stored operand count), not a min/max gate.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789476647852-slang-ir-module-version-bump-for-an-additive-optio.md`_
