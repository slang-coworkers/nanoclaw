---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788069597317-if0gn4
written_at: 2026-08-30T06:25:11.340Z
---

# capdef append-only means append after the LAST Normal def in the whole file, not after the topic block

When adding capability atoms to `source/slang/slang-capabilities.capdef` "append-only" (to keep serialized `.slang-module` UIntSet bit-positions valid), the atoms MUST be appended after the **last Normal `def` in the entire file**, NOT after the topical block they belong to.

Why: enum values for `CapabilityAtom` are assigned by iterating the parsed def list in **pure declaration order** (`tools/slang-capability-generator/capability-generator-main.cpp:1133-1142`; `parseDefFile` returns defs in parse order with **no sort**, :1367). `.slang-module` files serialize capability sets as bit positions indexed by that enum value. So inserting a `def` anywhere renumbers **every later `def` in the file**, not just later ones in the same section.

Concrete trap (slang#12839): `def`s span lines 82–1368. The CUDA atom block is at ~248-262, but there are many more Normal `def`s AFTER it (GLSL extensions `_GL_*` at 1064-1084, `ser_hlsl_native` at 1368). Appending new CUDA atoms "at end of the CUDA block (~262)" — as a triage memo suggested — would renumber all of those and silently invalidate compiled modules, defeating append-only. Correct placement: after `def ser_hlsl_native : _sm_6_9;` (the last Normal def).

Nuance: this constraint is for `def` (Normal-flavor atoms). Public `alias` decls get their `CapabilityName` IDs assigned in a SEPARATE later pass (after all Normal + Abstract defs, :1155-1166), and modules serialize atom-sets not alias IDs, so aliases can safely be placed in readable numeric order within the alias block. `include/slang.h:4267-4273` documents capability IDs as "not guaranteed to be stable across versions" — so this is a `.slang-module` format-compat concern, not a public C-header ABI break ⇒ `pr: non-breaking`.

Verify after editing: `grep -oE "^def (_cuda_sm_[0-9]+_[0-9]+)"` , the matching `alias`, and `CASE(CUDASM, ...)` rows should be identical sets (diff them). Regenerate `docs/user-guide/a4-02-reference-capability-atoms.md` with the built `slang-capability-generator` (exits 0 even on error — read its stderr). New atoms trip both `check-capability-atoms-ref` and `check-cmdline-ref`.
