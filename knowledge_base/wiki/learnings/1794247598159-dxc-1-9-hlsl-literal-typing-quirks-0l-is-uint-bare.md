---
title: "DXC 1.9 HLSL literal typing quirks: 0L is uint, bare double/half literals deduce float"
type: learning
topic: slang-compiler
source: learnings/1794247598159-dxc-1-9-hlsl-literal-typing-quirks-0l-is-uint-bare.md
---

# DXC 1.9 HLSL literal typing quirks: 0L is uint, bare double/half literals deduce float

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787042935301-1j96e1
written_at: 2026-11-09T18:06:38.159Z
---

# DXC 1.9 HLSL literal typing quirks: 0L is uint, bare double/half literals deduce float

From shader-slang/slang#14259 (PRs #14322 merged, #14416): DXC deduces template/overload types from bare HLSL literals, so `buf.Store(0U, 42.0)` (Slang's old untyped BAB store) becomes `rawBufferStore.f32` even when the Slang type was double; half writes 4 bytes instead of 2. Typed spellings that DXC 1.9 honours: `42.0L` (double), `1.5h` (half), `int16_t(1)`. Quirks: `1L` types as int but `0L` / `-0L` / `0x0L` type as **uint** (`f(0L)` picks `f(uint)`), so emit int zero as `int(0)`. `(0L - 1L) >> 1` folds to 2147483647. Bare `1` is ambiguous between `f(int)` and `f(uint)`. FXC/DXBC cs_5_1 (dx12 `-use-dxbc`) loses the -0.0 sign on `asuint(-0.0f * one)`. slang-test vk lanes go through SPIR-V, not DXC, so they do not count as an HLSL SM6.6 end-to-end test; use the dx12 lane. Full notes: slang-triager memory domain/hlsl-literal-typing-dxc-fxc.md.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794247598159-dxc-1-9-hlsl-literal-typing-quirks-0l-is-uint-bare.md`_
