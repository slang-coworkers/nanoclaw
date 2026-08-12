---
title: "[approver/clause-gap] Byte-for-byte equivalence to an incumbent code path proves CONSISTENCY, never CORRECTNESS — it cleared a real bug on slang-rhi#802"
type: learning
topic: review-approval
source: learnings/1785767781336-approver-clause-gap-byte-for-byte-equivalence-to-a.md
---

# [approver/clause-gap] Byte-for-byte equivalence to an incumbent code path proves CONSISTENCY, never CORRECTNESS — it cleared a real bug on slang-rhi#802

## Symptom

My round-1 review of slang-rhi#802 (Metal bindless `DescriptorHandle`) rated the implementation
**source-verified correct**, and the single strongest piece of evidence was a **byte-for-byte
raw-id equivalence check**: the new bindless path writes exactly the same 64-bit value shape as
the pre-existing *bound* path. That reads like unusually rigorous verification. It is worthless
here, and it cleared a genuine bug.

The bug (found by the fixer, not by me): `allocBufferHandle` returns `getDeviceAddress() + offset`
for **all** buffer kinds and explicitly discards `format` —

```cpp
// src/metal/metal-bindless-descriptor-set.cpp
Format format,                                                    // :26
// Metal bindless buffers are raw `device T*` pointers, so the format is irrelevant here
SLANG_UNUSED(format);                                             // :33
outHandle->value = bufferImpl->getDeviceAddress() + range.offset;  // :49
```

— but typed `Buffer<float>` / `RWBuffer<float>` emit as `texture_buffer<float, …>` into a
`[[texture(n)]]` slot and need a **texture `gpuResourceID`**, not a device address. Wrong *class*
of value, and the "format is irrelevant" comment is wrong.

## Root cause of the review miss

**The incumbent path has the same defect.** Verified at the branch head:

```cpp
// src/metal/metal-shader-object.cpp:562
DeviceAddress bufferPtr = buffer->getDeviceAddress() + slot.bufferRange.offset;
```

So "new path ≡ existing path" was *true* and told me nothing. An equivalence check can only
transfer correctness from the reference — and I never established that the reference was correct.
I treated a **differential** test as an **oracle** test. When the incumbent is itself unvalidated,
byte-equality propagates the bug with a clean bill of health attached.

Compounding it: slang-rhi never creates a Metal texture-buffer object anywhere (no
`newTextureBuffer` / `textureBufferWithDescriptor` under `src/metal/`), so typed
`Buffer<T>`/`RWBuffer<T>` are a **pre-existing backend gap**. The incumbent I was measuring
against had never worked for this class.

## How to catch it

When a diff's justification is "matches the existing path" / "same value as before" / "consistent
with how X already does it", ask **three** questions before crediting it:

1. **Is the reference path itself validated for THIS input class?** Name the test that exercises
   the reference for the specific case at hand. Here: no test ever fed a typed `Buffer<T>` through
   the Metal bound path, so the reference was unverified precisely where it mattered.
2. **Does the new path have inputs the incumbent never sees?** Bindless newly routes typed buffers
   through a path whose reference only ever handled untyped ones. Equivalence over a *narrower*
   historical input set says nothing about the widened set.
3. **Is a discarded parameter evidence of a missing case?** `SLANG_UNUSED(format)` beneath a
   comment asserting irrelevance is exactly the shape of an unhandled input class. Treat a
   deliberately-ignored discriminator as a **prompt to enumerate its values** and check each —
   here, enumerating `Format` against the emitted MSL type would have exposed it immediately.

Cheap concrete probe that would have caught it with no hardware: compile the test shader with the
pinned `slangc` and read the emitted MSL parameter list. `texture_buffer<...> [[texture(n)]]` next
to a handle the host fills with a device address is visible in one glance.

## Fix

**Candidate clause-set addition:** an equivalence-to-incumbent argument is downgraded to *weak*
evidence unless the reference path is separately validated for the same input class. Phrase the
finding as "consistent with `<path>`, which is itself unverified for `<input class>`" rather than
"verified equivalent" — the current wording overstates it and is what let me clear this.

Generalizes past this PR: **consistency arguments inherit whatever correctness the reference has,
including zero.** Same family as the other calibration atoms from #802 — source-correctness is not
behavioural correctness, and a signature/claim must be checked against the whole set it quantifies
over, not a convenient sample.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785767781336-approver-clause-gap-byte-for-byte-equivalence-to-a.md`_
