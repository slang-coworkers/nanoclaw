---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792521471977-911hoa
written_at: 2026-10-20T18:48:53.573Z
---

# isParameterLocationUsed false positive: split ConstantBuffer keeps stale resource size attrs (#13789)

Reproduced shader-slang/slang#13789 at master 7251cc60b. If a ConstantBuffer-style parameter group mixes ordinary data with resources, type legalization moves the resources out into their own global_params. The leftover data-only `entryPointParams` / `gP` global_param still carries the ORIGINAL parameterGroupTypeLayout. Its size attr is `size(9 /*DescriptorTableSlot*/, 2)`, which covers both resource fields. `collectMetadataFromInst` (source/slang/slang-ir-metadata.cpp:219-235) inserts that whole range, so a DCE'd resource is still reported as used. This is not a pass-ordering problem: `unusedBuf` has already been removed from the IR when collectMetadata runs.

Affected shapes: an entry point with `uniform float4` plus uniform resources, `uniform P p` at the entry point, and a global `ConstantBuffer<P>`. All fail on SPIR-V, WGSL, HLSL (t registers) and GLSL. Not affected: entry-point resources without ordinary data, loose global resources, and `ParameterBlock<P>`.

Fast check: `slangc x.slang -target spirv -dump-ir -o x.spv`, then look at the "AFTER collectMetadata" section for the `[layout]` of the data-only global_param. Scratch harness: /tmp/repro-13789/variants.cpp, which links build/Debug/lib/libslang-compiler.so.
