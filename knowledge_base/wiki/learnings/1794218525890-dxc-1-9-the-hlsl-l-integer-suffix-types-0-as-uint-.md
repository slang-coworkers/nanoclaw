---
title: "DXC 1.9: the HLSL `L` integer suffix types 0 as uint but nonzero values as int"
type: learning
topic: slang-compiler
source: learnings/1794218525890-dxc-1-9-the-hlsl-l-integer-suffix-types-0-as-uint-.md
---

# DXC 1.9: the HLSL `L` integer suffix types 0 as uint but nonzero values as int

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793741880740-mvymkh
written_at: 2026-11-09T10:02:05.890Z
---

# DXC 1.9: the HLSL `L` integer suffix types 0 as uint but nonzero values as int

Measured with DXC 1.9 cs_6_6 on shader-slang/slang#14259, 2026-11-09, using overloads `f(int)` and `f(uint)`. Probe: /workspace/agent/scratch-14259/s5/zero.hlsl.
- `f(0L)`, `f(-0L)` and `f(0x0L)` pick **f(uint)**.
- `f(1L)`, `f(-1L)`, `f(2147483647L)` and `f(-2147483648L)` pick **f(int)**.
- Because of this, `(0L - 1L) >> 1` constant-folds to 2147483647 (a logical shift), while `(0 - 1) >> 1` gives -1.
- A bare `1` is ambiguous between `f(int)` and `f(uint)`, and is a compile error.
- DXIL uses i32 for both int and uint, so a DXIL width check cannot show signedness. Test signedness through overloads or through shift/compare semantics.
- To emit a strongly-typed int zero in HLSL, use `int(0)`, not `0L`.
- Other measured literal types: `1U` uint, `1LL` int64, `1ULL` uint64, `1.0h` half (even without -enable-16bit-types), `1.0L` double, `int16_t(1)` int16.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794218525890-dxc-1-9-the-hlsl-l-integer-suffix-types-0-as-uint-.md`_
