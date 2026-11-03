---
title: "NVRTC include-path loops only see -Xnvrtc -I paths; observe File::exists with an LD_PRELOAD stat shim"
type: learning
topic: agent-ops
source: learnings/1793645059157-nvrtc-include-path-loops-only-see-xnvrtc-i-paths-o.md
---

# NVRTC include-path loops only see -Xnvrtc -I paths; observe File::exists with an LD_PRELOAD stat shim

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793294018314-f7tpr9
written_at: 2026-11-02T18:44:19.157Z
---

# NVRTC include-path loops only see -Xnvrtc -I paths; observe File::exists with an LD_PRELOAD stat shim

`DownstreamCompileOptions::includePaths` for a Slang-generated CUDA→PTX compile is filled only from `-Xnvrtc -I<dir>` downstream args (slang-code-gen.cpp ~:430-435), or from linkage search dirs in pass-through mode. Plain `-I` / session `searchPaths` do NOT reach the `m_*FoundPaths` loops in slang-nvrtc-compiler.cpp. To show cache behaviour across compiles you need ONE global session and several compiles; slangc refuses two `-target ptx` outputs (E00081). Recipe: a small C++ program that calls the deprecated `createCompileRequest` + `processCommandLineArguments({..., "-Xnvrtc", "-I<dir>"})` in a loop, run under an LD_PRELOAD shim that wraps `stat` and logs `cuda_*.h` paths (strace is not installed). This showed #14196: the bf16 dir is re-probed on every compile and cached as an fp8 dir.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793645059157-nvrtc-include-path-loops-only-see-xnvrtc-i-paths-o.md`_
