---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787935473208-qp6c29
written_at: 2026-08-28T17:07:53.954Z
---

# Slang witness-table clone deferral collides on empty mangled name for un-named requirement keys (#12817)

**Symptom:** `slangc` aborts with `assert failure: slang-dictionary.h(325): The key already exists in Dictionary.` while compiling generic code that involves interfaces with associated-type **equality** constraints (`__constraint T == U`) in a diamond inheritance (e.g. `IScalar : IAggregate : IShaped`, with a generic type conforming). Repro: shader-slang/slang#12817.

**Two disambiguation tricks that made triage fast:**
1. **The assert LINE tells you which Dictionary.** `slang-dictionary.h:325` is the **plain `Dictionary::add`**; `:576` is `OrderedDictionary::add`. Same message, different container. The front-end `WitnessTable` requirement store is an `OrderedDictionary<Decl*, RequirementWitness>` (asserts at :576), so a `:325` assert means the collision is in a **plain `Dictionary`**, NOT the semantic checker's witness table. Two research subagents mis-theorized the front-end OrderedDictionary; the assert line ruled it out immediately.
2. **`-dump-ir` localizes front-end vs back-end.** If `-dump-ir` prints the whole lowered module (interfaces, witness tables, main) and only THEN crashes, the front end succeeded and the crash is in the back-end IR pipeline. Here it was `linkIR` — the very first back-end step, before any named pass (`-dump-ir-after specializeGenerics` never reached its dump).

**Root cause:** `slang-ir-link.cpp:841` `cloneWitnessTableImpl` defers witness-table entries into `Dictionary<UnownedStringSlice, IRWitnessTableEntry*> deferredEntries` (link.cpp:102) keyed by `getMangledName(requirementKey)` (slang-ir-util.cpp:2832 — returns **empty slice** when the inst has no `IRLinkageDecoration`). Associated-type EQUALITY-constraint requirement keys carry no linkage/mangled name (they're excluded from the builtin-key branch at slang-lower-to-ir.cpp:1758-1759 by `!isEqualityConstraint`, and don't get a distinct `key_<mangled>` name). Two such keys in one witness table both defer under `""` → second `add("")` asserts. The existing guard at link.cpp:830-837 ALREADY eager-clones un-named `IRBuiltinRequirementKey` entries for this exact "collide on the empty name" reason — equality-constraint keys are a SECOND un-named class it doesn't cover.

**Fast controls that confirm this class of bug:** removing one of the two colliding constraints compiles (one key left); making the conforming type concrete avoids the clone/specialize path. Both were in the reporter's issue and matched exactly.

**Recommended fix layer:** broaden the eager-clone guard (link.cpp:835-843, mirror at :178-185) to any entry whose requirement key has empty `getMangledName` — minimal, no serialized-IR change. More principled producer-side alt: give equality-constraint keys a distinct mangled name (generalize the subtype-constraint collision fix already at slang-mangle.cpp:619-643) — but that touches serialized linkage names. Related prior: #7761 (mangled-name collisions in core module, same author tangent-vector).
