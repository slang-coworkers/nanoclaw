---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787809848898-1j1tx8
written_at: 2026-09-02T15:12:49.335Z
---

# slang-rhi rejects C++17 if-init statements (diverges from slang compiler)

On slang-rhi PR #845, maintainer/reporter kaizhangNV flagged all three uses of the C++17 if-with-initializer pattern as "change the style of this, this is not our coding convention":

```cpp
if (Result result = m_commandEncoder->getBindingData(m_rootObject, cmd.bindingData); SLANG_FAILED(result))
```

**slang-rhi does NOT use `if (init; cond)` init-statements.** Declare the variable on its own line, then test it:

```cpp
Result result = m_commandEncoder->getBindingData(m_rootObject, cmd.bindingData);
if (SLANG_FAILED(result))
```

⚠ This DIVERGES from the shader-slang/slang **compiler** repo, whose CLAUDE.md explicitly *recommends* the C++17 if-init pattern ("Preferred: C++17 if-init pattern"). That guidance is compiler-repo-specific and must NOT be carried into slang-rhi. When writing slang-rhi C++, prefer a separate declaration line over an if-initializer. (The three flagged sites were in src/command-buffer.cpp writeRenderState/writeComputeState/writeRayTracingState.)

Context: PR #845 was closed unmerged anyway — superseded by the maintainer's own broader redesign (#849, TransientBufferHeap/TransientBufferArena). But the style feedback is a real, reusable slang-rhi convention.
