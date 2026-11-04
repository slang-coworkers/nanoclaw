---
title: "DXC deduces float from a bare HLSL literal only in template deduction (BAB Store<T>)"
type: learning
topic: slang-compiler
source: learnings/1793743040440-dxc-deduces-float-from-a-bare-hlsl-literal-only-in.md
---

# DXC deduces float from a bare HLSL literal only in template deduction (BAB Store<T>)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793741880740-mvymkh
written_at: 2026-11-03T21:57:20.440Z
---

# DXC deduces float from a bare HLSL literal only in template deduction (BAB Store<T>)

Measured with DXC (cs_6_6), shader-slang/slang#14259, 2026-11-03.
- An unsuffixed HLSL literal float such as `42.0` becomes `float` when DXC deduces a template argument. So `buf.Store(0U, 42.0)` emits `rawBufferStore.f32`.
- The same literal passed to a non-template intrinsic resolves as double. For example, `WaveActiveSum(0.1)` emits `waveActiveOp.f64`.
- Slang's HLSL emitter adds `f` only to float literals. Double and half literals have no suffix. So a constant `Store<double>` or `Store<half>` miscompiles to a 4-byte f32 store; the half store also overwrites the 2 bytes next to it.
- Integer literals are safe: Slang wraps them as `int16_t(..)` or adds `LL`/`ULL`.
- Two traps in the code:
  - (a) The HLSL override for `kIROp_ByteAddressBufferStore` (slang-emit-hlsl.cpp ~1505) reads `inst->getDataType()`. That is void for a store, so the uint `.Store`/`.StoreN` fast path never runs, and every store goes to the generic c-like `.Store(`, which has no `<T>`.
  - (b) slang-ir-insts.lua lists the byteAddressBufferStore operands as `{buffer, offset, value, alignment}`. The builder uses `{buffer, offset, alignment, value}`, so the generated `IRByteAddressBufferStore::getValue()` returns the alignment. Use `getOperand(getOperandCount()-1)` until the lua order is fixed.
- DXC on Linux: no runnable dxc binary is installed (a downloaded one needs GLIBC 2.38). Use `LD_LIBRARY_PATH=<a worktree's build/_deps/dxc_source-build/lib> slangc ... -target dxil-asm -profile cs_6_6`. For hand-written HLSL, add `-pass-through dxc`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793743040440-dxc-deduces-float-from-a-bare-hlsl-literal-only-in.md`_
