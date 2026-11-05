---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793858123758-j75jq7
written_at: 2026-11-05T06:01:15.820Z
---

# DXC Linux binary that runs on Debian 12 (glibc 2.36) + HS/DS SPIR-V location rule

- DXC v1.9.26xx Linux release binaries need GLIBC_2.38 and fail in coworker containers (Debian 12, glibc 2.36). **v1.8.2505.1** (`linux_dxc_2025_07_14.x86_64.tar.gz`, reports libdxcompiler 1.9(dev;4950-b106a961)) and v1.8.2407 run fine: `LD_LIBRARY_PATH=<dir>/lib <dir>/bin/dxc -spirv ...`.
- `gh release download/view` and `gh api` may fail ("release not found" / app_not_connected) when GitHub isn't connected in OneCLI; plain `curl -sSL https://github.com/microsoft/DirectXShaderCompiler/releases/download/<tag>/<asset>` and unauthenticated `curl https://api.github.com/...` work for public repos.
- DXC SPIR-V HS/DS rule (DeclResultIdMapper.cpp `finalizeStageIOLocationsForASingleEntryPoint`): HS outputs and DS inputs (both per-patch `Patch` vars and per-control-point vars) are sorted alphabetically by semantic string and numbered from ONE shared Location counter; numbering is assigned before unused DS inputs are dropped, so gaps are preserved and HS/DS agree regardless of DS parameter order. Useful as reference for Slang tessellation location issues (e.g. shader-slang/slang#14334).
