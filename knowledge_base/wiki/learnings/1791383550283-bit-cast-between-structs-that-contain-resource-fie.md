---
title: "bit_cast between structs that contain resource fields ICEs on every target; the fix belongs in a pre-legalization structural pass"
type: learning
topic: misc
source: learnings/1791383550283-bit-cast-between-structs-that-contain-resource-fie.md
---

# bit_cast between structs that contain resource fields ICEs on every target; the fix belongs in a pre-legalization structural pass

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791381499183-xcxwtk
written_at: 2026-10-07T14:32:30.283Z
---

# bit_cast between structs that contain resource fields ICEs on every target; the fix belongs in a pre-legalization structural pass

#13480 (2026-10-07, master eaf758404). A `bit_cast<B,A>(a)` where A and B both hold a resource field (StructuredBuffer, Texture2D, ...) fails with E99997 on all 7 targets. This includes slangpy's Tensor and PrimalTensor, whose `_data` is a StructuredBuffer unless `__TARGET_CUDA__` is defined.
- **Two failure sites, by target.**
  - SPIR-V/HLSL/GLSL/Metal/WGSL: legalizeResourceTypes (slang-emit.cpp:2039) runs long before lowerBitCast (:2593) and splits the struct into a pair/tuple. legalizeInst has no kIROp_BitCast case, so it hits the default arm "non-simple operand(s)!" (legalize-types.cpp:2208).
  - CUDA/C++: resource legalization is skipped, and lowerBitCast's readObject has no resource leaf ("Unable to generate bit_cast code", lower-bit-cast.cpp:230).
- **Not a regression.** It fails on every release from 2024.1.1 on.
- **Fix that worked.** A prototype pre-pass placed before the `shouldLegalizeExistentialAndResourceTypes` block:
  - opaque leaves must match type-for-type and are copied as-is;
  - opaque-free subtrees stay ordinary BitCast;
  - a mismatch gets a user diagnostic.

  It fixed every target, with a subset run of 4420/4420. Putting the check inside lowerBitCast would be too late for the Khronos/HLSL/Metal/WGSL targets.
- **User workaround.** Copy the struct field by field. `reinterpret<>` is NOT a workaround: it produces invalid SPIR-V ("may not return a logical pointer") and E99999 on HLSL/GLSL.
- **Reproducing slangpy issues on master.** The slangpy v0.43.1 module no longer parses on master (staticarray.slang `matrix<T,R,C,L>` int vs MatrixLayoutMode). Use the module from slangpy main for master repros.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791383550283-bit-cast-between-structs-that-contain-resource-fie.md`_
