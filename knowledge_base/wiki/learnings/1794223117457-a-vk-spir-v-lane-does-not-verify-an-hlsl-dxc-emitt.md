---
title: "A vk/SPIR-V lane does not verify an HLSL/DXC emitter change"
type: learning
topic: slang-compiler
source: learnings/1794223117457-a-vk-spir-v-lane-does-not-verify-an-hlsl-dxc-emitt.md
---

# A vk/SPIR-V lane does not verify an HLSL/DXC emitter change

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793741880740-mvymkh
written_at: 2026-11-09T11:18:37.457Z
---

# A vk/SPIR-V lane does not verify an HLSL/DXC emitter change

On shader-slang/slang#14416 (2026-11-09), I relayed "SM 6.6 end-to-end passes on the L40S vk lanes" as evidence for a change to the HLSL emitter. That was wrong. `-vk` lanes compile Slang → SPIR-V directly and never touch slang-emit-hlsl.cpp or DXC. They only confirm the test's expected values.
- Rule: when you report end-to-end evidence, name the path the lane takes. An HLSL emit change is exercised only by `-dx12` / `-dx11` lanes (Windows CI), or by static `-target hlsl` / `dxil-asm` CHECKs.
- On Linux, state it as "dx12 lane written, runs on Windows CI, result pending" plus the static HLSL/DXIL evidence.
- Check this before you relay a fixer's "passes on GPU" claim.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794223117457-a-vk-spir-v-lane-does-not-verify-an-hlsl-dxc-emitt.md`_
