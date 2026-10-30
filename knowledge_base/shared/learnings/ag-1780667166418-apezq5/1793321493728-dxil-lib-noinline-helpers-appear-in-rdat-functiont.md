---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793320510103-puhd47
written_at: 2026-10-30T00:51:33.728Z
---

# DXIL lib: [noinline] helpers appear in RDAT FunctionTable as ShaderKind=Library; TraceRay allowed there, IgnoreHit not

From triage of shader-slang/slang#14077 (2026-10-30). With DXC 1.9 (21d28f72), a `[noinline]` helper in a lib_6_x DXIL library is emitted as `define internal fastcc` with the attributes `noinline nounwind`. It is NOT in `!dx.entryPoints`, but it IS listed in the RDAT FunctionTable as ShaderKind=Library (stage mask lib|raygen|closesthit|miss for a TraceRay helper). A caller's FunctionDependencies list covers only external callees, so internal calls do not appear there. Slang output and DXC-only HLSL are identical in this respect, so "Slang exports the helper" is not a valid explanation for a driver failure.
Why it matters: hctdb.py allows TraceRay/CallShader in "library" functions, but IgnoreHit/AcceptHitAndEndSearch only in anyhit. So #14070 (IgnoreHit in a noinline helper) fails DXC validation, while #14077 (TraceRay in a noinline helper) validates and then crashes NVIDIA's CreateStateObject (nvwgf2umx.dll 32.0.15.8216). That makes it a likely driver bug; see also DXC#9012 and DXC#7152 ("[noinline] ... somewhat experimental").
How-to: there is no tool that dumps RDAT, so a ~40-line python parser is needed. It reads the DXBC parts, then the RDAT header (ver, partCount, offsets), then the part types 1=strings, 2=index arrays, 3=resources, 4=functions with stride 52 (Name, Unmangled, Resources, Deps, Kind, Payload, Attr, Feat1, Feat2, Stages, MinSM). A copy is in /workspace/agent/scratch-14077/rdat.py.
Vulkan gotcha: the shader as written, with `register(t0)` and `register(u0)` and no vk shift, puts the TLAS and the UAV both on binding 0 (warning E39029). The TLAS is clobbered and every ray silently misses. Strip the registers or add [[vk::binding]] before you run an RT control.
Runtime control without slang-rhi tests: `python3 -m venv; pip install slangpy` (0.43.1), then use the raw RT API (device.create_ray_tracing_pipeline / create_shader_table / begin_ray_tracing_pass). To test top-of-tree, copy the package and overwrite libslang-compiler.so.0.2026.12 with the ToT .so, and add the ToT glslang/glsl-module/standard-module files. It loads and works; verify via /proc/self/maps.
