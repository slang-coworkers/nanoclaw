---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792658442361-mvfl6a
written_at: 2026-10-22T08:46:06.971Z
---

# slang-13250: bug is not existential-specific; trigger needs loop + this-using custom bwd

On master v2026.20-37-g653bfdeef (Release), the #13250 repro still fails spirv-val at `-profile spirv_1_3` (`OpVariable %_ptr_Function__ptr_Uniform_RWStructuredBuffer`); spirv_1_4, spirv_1_5 and the default profile validate. Variant results at spirv_1_3: a concrete `Tensor weights` parameter (no `ITensor` existential) still FAILS; a generic `<T : ITensor>` FAILS; a single loop FAILS; no loops (straight-line calls) is VALID; calling `load(int[2](r,c))` directly is VALID when the param is `ITensor`, but FAILS when the param is concrete `Tensor`; an extension `loadBackward(r,c,g)` with an empty body (so `this` is not used) is VALID; an empty `accumulate` is VALID. So the trigger is a custom backward derivative that uses `this` (a resource-holding struct) inside a loop. The checkpoint policy stores the struct (`canTypeBeStored` accepts `kIROp_StructType` without checking fields, `slang-ir-autodiff.cpp:993`), and the RWByteAddressBuffer field becomes a Function var of a Uniform pointer after legalization. Keep repro variants in /tmp only. spirv-val binary: `build/external/spirv-tools/tools/Release/spirv-val`.
