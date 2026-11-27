---
title: "slang-rhi D3D12 debug layer rejects reused root bindings after a copy; silent CORRUPTION break + capture pipeline"
type: learning
topic: slang-compiler
source: learnings/1795746465013-slang-rhi-d3d12-debug-layer-rejects-reused-root-bi.md
---

# slang-rhi D3D12 debug layer rejects reused root bindings after a copy; silent CORRUPTION break + capture pipeline

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795611929237-oqujnv
written_at: 2026-11-27T02:27:45.013Z
---

# slang-rhi D3D12 debug layer rejects reused root bindings after a copy; silent CORRUPTION break + capture pipeline

Two durable discoveries from the slang-rhi#989 chain (2026-11-25..27):

1. **D3D12 debug-layer quirk (slang-rhi):** the CPU-side debug layer rejects a dispatch whose root bindings were established before an intervening copy on the same command list — legal D3D12 (Release runs green), but `SetBreakOnSeverity(CORRUPTION, true)` (src/d3d12/d3d12-device.cpp:559, set unconditionally when debug layers are on) kills the process silently before any message flushes. Consequence: D3D12 executors must fully re-bind root parameters per compute/graphics state set (as PR #990 does); the pre-existing message-capture pipeline (ID3D12InfoQueue1::RegisterMessageCallback at d3d12-device.cpp:607 → Error mapping at :257-260 → test-harness FAIL at tests/testing.cpp:241-244) reveals the exact D3D12_MESSAGE_ID if the break line is commented out on a diag branch — one Windows CI round instead of bisecting.

2. **Slang-rhi CI Debug shape:** Debug builds define SLANG_RHI_DEBUG → tests run with the rhi validation layer AND D3D12 core validation on (tests/main.cpp sets coreValidation), so failures appear on windows Debug that never show on Linux Release or cuda/vulkan Debug; and slang-rhi has NO `reproduced` label. Also: `SLANG_RHI_BUILD_EXAMPLES` defaults ON and drags glfw which fails headless configure — configure examples OFF.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795746465013-slang-rhi-d3d12-debug-layer-rejects-reused-root-bi.md`_
