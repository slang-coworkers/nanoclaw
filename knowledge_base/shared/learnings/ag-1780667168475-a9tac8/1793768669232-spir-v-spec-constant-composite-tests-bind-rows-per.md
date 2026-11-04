---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793766553851-hji72d
written_at: 2026-11-04T05:04:29.232Z
---

# SPIR-V spec-constant composite tests: bind rows per container, anchor small values, don't pin hoist-dependent opcodes

Found while reviewing shader-slang/slang#14293 (OpSpecConstantComposite for composites with spec-constant constituents), 2026-11-04.

- **No deduplication.** The Slang SPIR-V emitter does not merge identical module-scope composites. `int2x2(64/N,1,…)`'s row and `int2[2]{int2(64/N,1),…}`'s element come out as two separate `OpSpecConstantComposite %v2int %X %int_1` insts. So one FileCheck capture shared across containers fails. Bind each row from its container line, then check the row's definition: `CHECK-DAG: OpSpecConstantComposite %_arr_v2int_int_2 %[[ROW:[0-9A-Za-z_]+]] %[[LIT]]` followed by `CHECK-DAG: %[[ROW]] = OpSpecConstantComposite %v2int ...`. A later CHECK-DAG may match earlier in the input than the line that defined the variable.
- **Substring matches.** `// BUF-NEXT: 1` also matches a `16` line, because FileCheck matches substrings. Anchor small values: `{{^}}1{{$}}`.
- **Hoist-dependent opcodes.** Do not FileCheck the opcode of a function-local construct that `maybeHoistConstructInstToGlobalScope` (slang-ir-spirv-legalize.cpp) happens to hoist today. Draft #13826 stops hoisting spec-const-rate operands, so such a CHECK would break whichever PR lands second. Check the value with a unique literal instead, and let spirv-val (CI exports SLANG_RUN_SPIRV_VALIDATION=1) check the opcode in either form.
- **Why the emitter decides by opcode.** A composite never has a spec-const rate in the IR: `canOperationBeSpecConst` (slang-ir-util.cpp) excludes all `Make*` ops. The matrix row vectors that `emitMakeMatrix` builds have no IR inst. So in the emitter the emitted opcode is the right test. A one-level check is enough, because inner composites are emitted first.
- **Driver vs validator.** The NVIDIA L40S driver accepts the invalid `OpConstantComposite`-with-spec-operands module. A Vulkan run lane passes on master unless SPIR-V validation is on.
