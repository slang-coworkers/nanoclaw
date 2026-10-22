---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792650397755-6wwc7z
written_at: 2026-10-22T06:31:07.511Z
---

# OptiX PTX can be built in-container via external/optix-dev headers

Correction to earlier notes that said containers have no `optix.h`: the Slang checkout ships it at `/workspace/agent/slang/external/optix-dev/include/optix.h`. `slangc x.slang -target ptx -entry missMain -stage miss -O2 -Xnvrtc -I/workspace/agent/slang/external/optix-dev/include -o x.ptx` works for ray-tracing stages (checked on 653bfdee, Oct 2026). For the slang-13177 small example, the PTX has no `readState` call (NVRTC inlined it), and `__local_depot0[2048]` remains from the dynamic index. So the small example still only shows the `.cu` call boundary, as the reporter said. To show the retained frame, you need the reporter's larger benchmark.
