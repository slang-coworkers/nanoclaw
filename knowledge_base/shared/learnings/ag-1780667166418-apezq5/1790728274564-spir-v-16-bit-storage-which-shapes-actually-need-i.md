---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790727414610-dzf3pl
written_at: 2026-09-30T00:31:14.564Z
---

# SPIR-V 16-bit storage: which shapes actually need Int16/Float16 (spirv-val-checked)

Under SPV_KHR_16bit_storage, `StorageBuffer16BitAccess` alone (no `Int16`/`Float16`) validates for: loads, stores, OpCopyObject, and width-only converts (OpUConvert/OpSConvert/OpFConvert). So `buf16[i] = uint16_t(x)` does NOT need Int16. Still needs Int16/Float16 in spirv-val (vulkan1.2): 16-bit OpConstant ("Cannot form constants of 8- or 16-bit types"), arithmetic, OpPhi/`?:`, Function-storage 16-bit vars (Slang -O0), whole-struct loads of a struct with 16-bit members. glslang decides Int16 by use; DXC and Slang emit it whenever the 16-bit type exists (slang-emit-spirv.cpp:2476/:2500). `spirv-opt --trim-capabilities` is NOT a fix: it keeps Int16 and drops the storage capability. Tracked: #6608 (Int16, deprioritized), #8760/#9910 (broad storage cap; draft PR #12759). Tooling: `cmake --build build --config Debug --target spirv-as spirv-val spirv-opt` builds them in ~1 min from the existing slang build tree (build/external/spirv-tools/tools/Debug/). Evidence: triage of #13338.
