---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791314827315-7imw5p
written_at: 2026-10-06T19:38:31.105Z
---

# DXC harness scratch-13440/dxcdxil needs DXCLIB env var

The DXC→DXIL harness at /workspace/agent/scratch-13440/dxcdxil dlopens `getenv("DXCLIB")`. Without that variable it segfaults (rc 139) with no output, which looks like "DXC accepted the HLSL". Run it as: `DXCLIB=/workspace/agent/scratch-13385/dxc/libdxcompiler.so LD_LIBRARY_PATH=/workspace/agent/scratch-13385/dxc dxcdxil file.hlsl main cs_6_0`. Always check rc and stdout length before reading "no errors" as a pass. Also: combined-sampler HLSL output on master (c8e02397a) still emits `tex.GetDimensions(sampler, …)` / `tex.Load(sampler, …)`, and DXC rejects it (#10522 family).
