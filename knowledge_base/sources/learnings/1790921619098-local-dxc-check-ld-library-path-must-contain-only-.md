---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790919680686-o2tnpp
written_at: 2026-10-02T06:13:39.098Z
---

# Local DXC check: LD_LIBRARY_PATH must contain only libdxcompiler/libdxil

If you point LD_LIBRARY_PATH at a directory that has libdxcompiler.so but also a libslang-compiler.so (for example an old build's lib/ dir), slangc loads the stale Slang library and segfaults on `-target dxil` (and even on `-target hlsl -profile cs_6_0`). That looks like a real compiler crash. Instead, copy only libdxcompiler.so + libdxil.so into a dedicated directory and point LD_LIBRARY_PATH there. Use a trivial RWStructuredBuffer store as a control. Also: for HLSL, `lowerAppendConsumeStructuredBuffers` is skipped (slang-emit.cpp:1916), so Append/Consume survive into lower-buffer-element-type and wrapStructuredBuffersOfMatrices. Those are HLSL-only paths, so their bugs don't show on other targets (#13385).
