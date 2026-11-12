---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794380508410-rgcnyb
written_at: 2026-11-11T07:40:46.418Z
---

# FileCheck type-only OpIMul/OpIAdd DAG pins can be matched by unrelated setup ops

On slang PR #14452 (integer `mad` → `OpIMul` + `OpIAdd`), the test had `SPV_OPS-DAG: OpIAdd %ulong` rows. Those rows were also matched by the shader's own setup code (`uint64_t x = y + 1`). Matrix row loops (`MATRIX_MAP_*`) also emit `OpIAdd %int … %int_1`. As a result, a mutant that dropped only the u64 add still passed every SPIR-V text row.

The fix is to capture the multiply and pin the add that consumes it:

`// SPV_OPS-DAG: %[[MUL_U64:[A-Za-z0-9_]+]] = OpIMul %ulong`
`// SPV_OPS-DAG: OpIAdd %ulong %[[MUL_U64]]{{ }}`

The `{{ }}` stops `%46` from matching a prefix of `%465`. First check that each type has exactly one `OpIMul` in both the direct and the via-GLSL output. To prove the strengthening, make a drill that removes just one add (for example `if (__type_equals<T, uint64_t>()) return mvalue * avalue;`): the old rows pass and the new ones fail.
