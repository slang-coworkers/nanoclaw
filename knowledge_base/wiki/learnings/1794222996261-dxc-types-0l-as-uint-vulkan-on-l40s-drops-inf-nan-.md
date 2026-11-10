---
title: "DXC types 0L as uint; Vulkan on L40S drops inf/NaN/-0 through arithmetic"
type: learning
topic: slang-compiler
source: learnings/1794222996261-dxc-types-0l-as-uint-vulkan-on-l40s-drops-inf-nan-.md
---

# DXC types 0L as uint; Vulkan on L40S drops inf/NaN/-0 through arithmetic

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793742971321-k0j5bx
written_at: 2026-11-09T11:16:36.261Z
---

# DXC types 0L as uint; Vulkan on L40S drops inf/NaN/-0 through arithmetic

- **`0L` is `uint` in DXC 1.9.** With `-HV 2021`, DXC types `0L`, `-0L` and `0x0L` as `uint`: `f(0L)` picks `f(uint)` over `f(int)`. Every other `L` value is `int`, including `1L`, `-1L` and `-2147483648L`. This explains the "constant-fold quirk" where `(0L - 1L) >> 1` gives 2147483647 but `(int(0) - 1L) >> 1` gives -1. When emitting typed HLSL, an int zero needs `int(0)`. An unsuffixed `1` is ambiguous between `f(int)` and `f(uint)`. `1.0h` compiles at cs_6_0 without -enable-16bit-types (half is 32-bit there). Probe: `slangc -pass-through dxc -target dxil-asm -profile cs_6_6 -entry main x.hlsl`, with overloaded `uint f(int)/f(uint)/...` stored to a RWByteAddressBuffer.
- **Vulkan doesn't keep specials through arithmetic.** On the L40S, SPIR-V arithmetic does not preserve inf, NaN or -0.0, because Slang emits no SignedZeroInfNanPreserve. Stores of `inf * runtimeOne` vanished entirely (the sentinel stayed), and `-0.0f * one` stored +0. Plain constant stores were bit-exact. For tests that do arithmetic on special values, cross-check on a `-cpu` lane, not vk.
- **SM 5.1 BAB stores aren't bit-cast.** At cs_5_1, Slang does not bit-cast byte-address-buffer stores (`useBitCastFromUInt` applies only <= DX_5_0, slang-emit.cpp). So FXC's `Store(uint, uint)` would value-convert a float.
- **Skipped lanes.** `//TEST:SIMPLE ... -target dxbc-assembly` tests are ignored on Linux (no FXC).

(Found during PR #14416.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794222996261-dxc-types-0l-as-uint-vulkan-on-l40s-drops-inf-nan-.md`_
