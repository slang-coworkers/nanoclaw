---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787936806631-ickqz6
written_at: 2026-08-28T17:26:44.557Z
---

# slang#12817 equality-constraint key has no mangled name = producer bug (removeLinkageDecorations), not a linker bug

**Symptom:** `slangc -target hlsl/-target spirv` aborts in `linkIR` with `slang-dictionary.h(325): The key already exists in Dictionary.` when an interface carries ≥2 associated-type EQUALITY constraints (`__constraint Scalar == This`, `__constraint Mask == bool`) reached via a diamond and a generic conforms to it. Crash: `cloneWitnessTableImpl` (slang-ir-link.cpp:841) defers witness-table entries into a plain `Dictionary<UnownedStringSlice, IRWitnessTableEntry*>` keyed by `getMangledName(requirementKey)`; the two equality-constraint keys have empty mangled names → second `.add("")` asserts.

**The tempting-but-WRONG fix (Approach A, rejected by maintainer tangent-vector + independent codex CODE_REVIEW):** broaden the linker's existing `IRBuiltinRequirementKey` eager-clone guard to eager-clone ANY entry whose requirement key has empty `getMangledName(...)`. This MASKS a producer-invariant violation. `IRBuiltinRequirementKey`s are *intentionally* anonymous (hoistable, linkage-free by design, slang-ir-insts.lua). Ordinary equality-requirement keys are NOT — they are created WITH stable linkage via `getInterfaceRequirementKey` (slang-lower-to-ir.cpp:1813) and are *expected* to keep it. An empty name on them is a bug, not a valid input shape.

**Real producer root cause:** for an interface-level equality constraint, `visitGenericTypeConstraintDecl` returns `getInterfaceRequirementKey(decl)` — the KEY *is* the lowered requirement value. In `visitInterfaceDecl`'s addEntry the equality constraint falls into the `else` branch (slang-lower-to-ir.cpp:~12251) where `requirementVal = ensureDecl(...).val` IS the key, and `removeLinkageDecorations(requirementVal)` (slang-lower-to-ir.cpp:12261) then strips the KEY's linkage. That strip was added by **#7764 (commit 5937e1e6b)** for method-requirement *values*, which is wrong for equality constraints whose canonical entry is `(named key, null value)` — there is no separate value to strip. Correct fix: preserve the named key, leave the equality requirement value null, don't strip linkage. No linker change.

**Reusable lesson:** an empty/absent canonical identifier (mangled name, requirement key, witness key) on an IR inst that is *supposed* to carry one is a producer bug. Before teaching a consumer (linker/emit) to tolerate the missing identifier, ask whether that class of inst is *intentionally* anonymous (like builtin keys) or *accidentally* stripped. `git blame` the strip site. Fixing the consumer to accept malformed input is exactly the "do not mask" anti-pattern in CLAUDE.md's methodology. Here the codex CODE_REVIEW [High] finding and the maintainer independently converged on the same producer-side conclusion.
