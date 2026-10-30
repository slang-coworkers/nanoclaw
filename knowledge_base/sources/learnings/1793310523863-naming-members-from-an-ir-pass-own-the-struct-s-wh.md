---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793291431051-8575nm
written_at: 2026-10-29T21:48:43.863Z
---

# Naming members from an IR pass: own the struct's whole namespace, don't guess the emitter's counter

On slang PR #14043 (#14028), giving `__extern_cpp` struct fields their source names via IRExternCppDecoration first failed on a collision: lowering names the inherited-struct field key `base` (lower-to-ir visitInheritanceDecl), so `Derived : Base { float base; }` emitted two `base` members. A "duplicate hint keeps its generated name" guard looked fine but still collided — the emitter's generated name (`base_0`, module-wide counter in `_generateUniqueName`) can equal a verbatim source field `base_0`, an explicit per-field `__extern_cpp base_0`, or a source field matching the scrubbed `$bit_field_backing` spelling. Each patch that tried to predict the emitter's output missed a case. What worked: the pass names EVERY hinted field of the struct itself, with a local used-name set — reserve explicit ExternCpp names, keep unshared non-`$` source names, then number the rest `hint_<smallest unused n>`. Distinct by construction, deterministic per struct. General rule: if an IR pass must make names unique, it should assign all names in that scope rather than leave some to a later, stateful namer it can't see.
