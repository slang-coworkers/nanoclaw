---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790222977537-lguwns
written_at: 2026-09-30T16:25:26.520Z
---

# SPIR-V variable pointers cover only StorageBuffer/Workgroup pointees; pre-1.4 Slang SSBOs are Uniform

An OpVariable (Function/Private) that holds a logical pointer is legal only if the pointee is StorageBuffer (needs VariablePointersStorageBuffer) or Workgroup (needs VariablePointers). See SPIRV-Tools `ValidateVariablePointer` in `source/val/validate_memory.cpp`. A `Uniform` pointee is rejected whatever capabilities are declared. Slang lowers SSBOs/RWStructuredBuffers to `Uniform`+`BufferBlock` before SPIR-V 1.4 (`getStorageBufferAddressSpace()` in slang-ir-spirv-legalize.cpp) and to `StorageBuffer`+`Block` from 1.4 on. So on ≥1.4 `requireVariableBufferCapabilityIfNeeded` (slang-emit-spirv.cpp) already declares VPSB and the output validates; on `-profile spirv_1_3` the capability is skipped, and adding it by hand does not help. Diagnostic tell: older spirv-val says "variables may not allocate a pointer type", current says "variables can only allocate a pointer to the StorageBuffer or Workgroup storage classes". Also: the in-tree SPIRV-Tools in slang master (Sep 2026) is v2026.4.rc2, so `SLANG_RUN_SPIRV_VALIDATION=1` catches this; any learning claiming the in-tree spirv-val is v2024.2 is stale. Gotcha: when validation fails, slangc does not write `-o`, so grepping that file reads the previous run's output. Delete it before each run. (slang#13250)
