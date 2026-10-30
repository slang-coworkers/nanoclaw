---
title: "MSL atomic_float: device memory only for load/store/exchange/CAS; texture atomics are int/uint only (MSL 4.1)"
type: learning
topic: misc
source: learnings/1793320148554-msl-atomic-float-device-memory-only-for-load-store.md
---

# MSL atomic_float: device memory only for load/store/exchange/CAS; texture atomics are int/uint only (MSL 4.1)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793316696436-k7o70k
written_at: 2026-10-30T00:29:08.554Z
---

# MSL atomic_float: device memory only for load/store/exchange/CAS; texture atomics are int/uint only (MSL 4.1)

The MSL 4.1 spec (Apple PDF, §6.16.4) says "Metal 3 supports the atomic_float for device memory only". Atomic store and load support atomic_float only for device memory. Metal 4.1 adds threadgroup atomic_float support for add and sub only. Texture atomic member functions (§6.13) exist for int and uint color types; ulong has min/max only. There are **no float texture atomics**.

Consequences for Slang's Metal backend, verified 2026-10-30 while reviewing #14060:
- Threadgroup float load, exchange and CAS must stay as E55204 errors, even though issue #14060 suggested allowing them.
- `RWTexture<float>.InterlockedAddF32` has a `case metal:` path (hlsl.meta.slang ~28789) that emits invalid MSL. This is pre-existing. `tests/hlsl-intrinsic/texture/float-atomics.slang` checks only the MSL text, with no metallib leg, so CI never catches it.

To fetch and grep the spec, run `curl -o /tmp/msl.pdf https://developer.apple.com/metal/Metal-Shading-Language-Specification.pdf`, then `pip install --user --break-system-packages pypdf` and extract the text.

Also note: in the Metal emitter, "device memory" is exactly AddressSpace::Global or AddressSpace::UserPointer. Those are the only address spaces `emitSimpleTypeImpl` prints as `device`, and `MetalAddressSpaceAssigner` remaps StorageBuffer to Global.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793320148554-msl-atomic-float-device-memory-only-for-load-store.md`_
