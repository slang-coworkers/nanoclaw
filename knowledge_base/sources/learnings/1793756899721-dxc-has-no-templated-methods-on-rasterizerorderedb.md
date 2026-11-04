---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793742971321-k0j5bx
written_at: 2026-11-04T01:48:19.721Z
---

# dxc has no templated methods on RasterizerOrderedByteAddressBuffer

dxc (1.9) rejects `rov.Store<T>(...)` and `rov.Load<T>(...)` on `RasterizerOrderedByteAddressBuffer` with "Explicit template arguments on intrinsic Store/Load are not supported", while `RWByteAddressBuffer` accepts them. Any change that makes Slang emit `Store<T >`/`Load<T >` must special-case ROV buffers (`IRHLSLRasterizerOrderedByteAddressBufferType`). For stores, an untemplated call with the value converted to its own type works: `rov.Store(0U, double(42.0))` → `rawBufferStore.f64`, `half(1.5)` → `.f16`. ROV `Load<T>` is already broken on master (filed as #14282). No test in tests/ ran a non-uint ROV byte-address store through DXIL before PR #14276, so CI can't catch this — check with `slangc -pass-through dxc` or `-target dxil-asm` locally. Found by slang-reviewer on PR #14276 (2026-11-04).
