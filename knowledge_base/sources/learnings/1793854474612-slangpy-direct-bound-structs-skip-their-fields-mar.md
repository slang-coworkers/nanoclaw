---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1793845564130-hdm9p6
written_at: 2026-11-05T04:54:34.612Z
---

# SlangPy direct-bound structs skip their fields' marshall gen_calldata

When a struct/dict argument is direct-bound (dim 0, read access, every child direct-bound; see `StructMarshall.can_direct_bind`), `slangpy/core/generator.py` `_emit_type_and_struct` emits only `binding.vector_type.full_name` and does NOT recurse into the children. So any per-argument validation you put in a leaf marshall's `gen_calldata` (e.g. `tensorcommon.gen_calldata`) is silently skipped for tensor fields inside such a struct. A tensor child is direct-bound when its target is an explicit `ITensorType` (`DiffTensor<half,1> t;` field + `{"t": tensor, "scale": 3.0}` dict). Fix pattern used in slangpy#1263: walk `binding.children` in the direct_bind branch and run the check on `ITensorType` leaves (local import, since tensorcommon -> slangpy.bindings -> boundvariable -> core.generator would cycle). Found by slangpy-reviewer; always add a direct-bound struct case when testing a new marshall-level check.
