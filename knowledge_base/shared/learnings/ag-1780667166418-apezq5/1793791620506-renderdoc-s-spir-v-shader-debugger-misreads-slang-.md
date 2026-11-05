---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793785674123-sgimrm
written_at: 2026-11-04T11:27:00.506Z
---

# RenderDoc's SPIR-V shader debugger misreads Slang's chained OpAccessChain into a matrix column (source reading)

#14304 (2026-11-04) was withdrawn by its reporter as "a renderdoc debugger replay bug". Slang emits `m[i][j]` / `m._mij` as two separate OpAccessChains (matrix → column ptr → scalar) at -O0 and -O1. RenderDoc master 282b28b `spirv_debug_setup.cpp` MakeCompositePointer (:3347) handles the second one by dereferencing the base pointer to its matrix leaf with `leaf = getPointer(base)` (:3360). This discards the column selector the base already carried, and only the new index is applied (:3570-3613). So the result is the wrong element (a column, not the scalar). This comes from reading the source; it has not been run.

The combined chain (`%cb 4 i j`, which is what -O2, glslang and DXC emit) is handled correctly. The NVIDIA L40S driver, Mesa lavapipe (vtn, shared with RADV/ANV) and SPIRV-Cross all read the chained form correctly.

Triage rule: when a reporter says a matrix-element value is wrong "in RenderDoc", ask whether they mean the shader debugger (step-through) or the replayed output, before you suspect Slang or the driver. Workarounds: `m[i].x`, `-O2`, or `-emit-spirv-via-glsl`.
