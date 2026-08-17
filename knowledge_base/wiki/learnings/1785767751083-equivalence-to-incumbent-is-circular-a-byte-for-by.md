---
title: "Equivalence-to-incumbent is circular: a byte-for-byte review can pass a real bug"
type: learning
topic: ci-tooling
source: learnings/1785767751083-equivalence-to-incumbent-is-circular-a-byte-for-by.md
---

# Equivalence-to-incumbent is circular: a byte-for-byte review can pass a real bug

## The trap

Justifying a new code path by proving it produces **the same value the existing path already produces** demonstrates *consistency*, not *correctness*. If the incumbent path is itself wrong, the new code is wrong in exactly the same way — and a reviewer who checks equivalence will pass it. The check is circular.

## How it bit

shader-slang/slang-rhi#802 (Metal bindless `DescriptorHandle`). The new `allocBufferHandle` returned `getDeviceAddress() + offset` for **every** buffer kind and discarded the `format` argument:

```cpp
// Metal bindless buffers are raw `device T*` pointers, so the format is irrelevant here
// (unlike the typed-buffer-view backends) and only the access decides read vs read-write.
SLANG_UNUSED(format);
```

A peer review verified the raw-id equivalence **byte-for-byte** against the argument-buffer writer and approved it. Both of us missed that Slang emits a typed `Buffer<float>` / `RWBuffer<float>` as `texture_buffer<float,…>` bound to a **`[[texture(N)]]`** slot — whose argument-buffer representation is a texture **resourceID**, not a device address.

The equivalence check passed *precisely because* the incumbent path had the same wrong shape: `metal-shader-object.cpp` also writes `getDeviceAddress() + offset` for `TypedBuffer` / `MutableTypedBuffer`. Matching it validated nothing.

The bug only surfaced once the tests actually executed (they had been silently skipping — see the companion learning on green macOS jobs).

## How to avoid it

- **Validate against the consumer's contract, not a sibling producer.** Ask "what does this field have to contain, per the ABI, for *this* resource class?" — not "what does the other code write here?"
- **Enumerate the classes the path covers and check each.** Tabulating the six buffer kinds by their emitted slot exposed the bug immediately:

  | declaration | emitted MSL | required 64-bit value |
  | --- | --- | --- |
  | `StructuredBuffer<T>`, `ByteAddressBuffer` (+RW) | `T device*` → `[[buffer(n)]]` | device address ✅ |
  | `Buffer<T>`, `RWBuffer<T>` (typed) | `texture_buffer<T,…>` → `[[texture(n)]]` | texture resourceID ❌ |

- **Treat `SLANG_UNUSED(param)` + "this doesn't matter" as a red flag** worth re-deriving per class. A genuinely irrelevant input deserves a per-class reason.
- **When asking for review, hand over the consumer contract**, not just the producer diff. Given only the diff, a reviewer can check consistency and nothing more.
- **Prefer an executed test.** This survived static review, cross-backend comparison, and an independent byte-for-byte verification; running the code killed it in one CI job.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785767751083-equivalence-to-incumbent-is-circular-a-byte-for-by.md`_
