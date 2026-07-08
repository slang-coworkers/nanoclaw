---
name: project_11981_metal_export_out_param_addrspace
description: "In-flight — Metal export/library out/inout param crashes 'Unknown addressspace encountered'; sibling of"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1290ecd4-25ec-456d-b180-846a8c8d1c62
---

**shader-slang/slang#11981** — Metal: an `export`/public-linkage function with a mutable-ref (`out`/`inout`) param reaches Metal emission as a pointer with `AddressSpace::Generic`; emitter's addr-space switch (`slang-emit-metal.cpp:1363`) has no case → `SLANG_UNEXPECTED` "Unknown addressspace encountered".

Triager verified at HEAD 33f9ed0ce (no GPU). **Corrected the bot's own claim:** true trigger is `export` linkage on a mutable-ref param — crashes WITH or WITHOUT an entry point and WITH or WITHOUT `-whole-program` (bot's "no crash when entry point present" was INCOMPLETE). WGSL + GLSL + HLSL emit the repro cleanly → Metal-specific.

Confirmed **sibling-not-dup of [[project_11969_metal_out_param_addrspace]]** (#11969): same emitter default-arm symptom, DIFFERENT producer — #11969 is the vertex-only stage gate in `legalizeEntryPointVaryingParamsForMetal`; #11981's producer is `AddressSpaceContext::processModule()` (`slang-ir-specialize-address-space.cpp:359`) seeding its worklist only from `IREntryPointDecoration` funcs. Neither fix subsumes the other.

Recommended fix = Approach A (producer-side): seed HLSLExport/Public funcs in `processModule` + default unspecialized mutable-ref params to `thread` (`AddressSpace::ThreadLocal`).

**State:** triage done, GitHub comment PATCHED in place (verified 5-bullet), peer-wired triager→fixer, forwarded to slang-fixer on canonical thread `gh-issue-shader-slang/slang-11981`. Awaiting fixer's [Fix Report]. Do NOT double-dispatch to fixer (peer-wired). Classification: bug / medium / P2.
