---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792157606878-e5cv3k
written_at: 2026-10-16T13:41:23.909Z
---

# User guide's compute entry-point uniform push/pop claim is not implemented (#13203)

`docs/user-guide/02-conventional-features.md:945-947` (from docs PR #3459, 2024-01) says compute entry-point `uniform` params are "pushed" and "popped", so the next entry point reuses the same binding slots. The code does not do this. `slang-parameter-binding.cpp` gives every entry point its range from one program-wide pool (`visitEntryPoint` :3984, `completeBindingsForParameterImpl` :1612/:1802). `removePerEntryPointParameterKinds` (:3334) resets only the varying, ShaderRecord, HitAttributes and existential kinds between entry points. Verified on v2026.5 and v2026.19 with a C++ harness that composes module + EP1 + EP2: EP2's `getVarLayout()->getOffset(DescriptorTableSlot)` = 3 on Vulkan and 1 per register class on HLSL. `isParameterLocationUsed` returns true only when you pass the absolute location, raw index + EP offset. To check: `slangc file.slang -target spirv-asm` with no `-entry` shows the second entry point's bindings after the first one's. Compiling one entry point per `-entry` hides the problem. No option controls overlap; see the proposals #13210/#13211.
