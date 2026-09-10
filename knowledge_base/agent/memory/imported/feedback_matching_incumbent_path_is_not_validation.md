---
name: feedback_matching_incumbent_path_is_not_validation
description: "A differential test is not an oracle test: equivalence to an existing path transfers correctness only if the reference was established correct — and only over the same input set"
metadata:
  node_type: memory
  type: feedback
  originSessionId: unknown-prior-session
---

When a review verifies a new code path by showing it produces **the same value as the existing
path**, that establishes *consistency with the incumbent* — never correctness. If the incumbent is
wrong, the check passes and the bug ships.

**The sharper framing (approver's, better than my original):** this is **treating a differential test
as an oracle test.** An equivalence check can only *transfer* correctness from the reference, so it is
worth exactly as much as (a) the reference having been established correct, and (b) the two paths
sharing the same input domain. #802 failed both: nobody established the reference was right for typed
buffers, and it never had to be — slang-rhi creates **no Metal texture-buffer object anywhere**, so
the incumbent had only ever seen untyped buffers. **Equivalence over a narrower historical input set
says nothing about the widened one** the new feature introduces.

**Why:** slang-rhi#802's review verified "raw native-id equivalence **byte-for-byte**" for
`DescriptorHandle` values and treated it as the load-bearing correctness argument (recorded as
VERIFIED at round 1). It could not catch the real bug: `allocBufferHandle` returns
`getDeviceAddress()+offset` for *all* buffer kinds and discards `format`
(`metal-bindless-descriptor-set.cpp:31-33`), but typed `Buffer<float>`/`RWBuffer<float>` emit as
`texture_buffer<...>` on Metal and need a **texture `gpuResourceID`**, not an address. The check
passed precisely *because* the pre-existing bound path (`metal-shader-object.cpp:562-563`) writes the
same wrong shape. Two paths agreeing on the wrong class of value looks identical to two paths being
right.

**How to apply:**
- Treat "matches the existing path" as a **consistency** clause and label it that way in a report.
  The correctness clause has to come from somewhere else: the spec, the consumer's expectation, or
  execution.
- Ask *what would this check say if the incumbent were also wrong?* If the answer is "it would still
  pass," it is not evidence of correctness.
- Prefer checking the new value against the **consumer** (what the shader/ABI actually dereferences)
  rather than against a sibling producer.
- **Ask whether the new feature widens the input domain.** If the change routes a *new* input class
  through a path whose reference only ever saw the old classes, the equivalence check is vacuous
  exactly where the risk is.
- 🔎 **Grep-able tell: a deliberately-discarded discriminator is the shape of an unhandled input
  class.** `SLANG_UNUSED(format)` under a comment asserting *"the format is irrelevant here"*
  (verified live at `metal-bindless-descriptor-set.cpp:26,31-33`) is the whole bug in two lines. When
  a parameter is explicitly thrown away with a justifying comment, **enumerate the values it can take
  against what the consumer expects for each** — here, one `slangc` invocation, no hardware, and
  typed `Buffer<float>` → `texture_buffer<...>` is visible at a glance. Treat such a comment as a
  claim to test, not a note to trust.
- Corollary to the #802 calibration lesson: a clean source read licenses only source-correctness. Here
  even a *cross-referenced* source read didn't, because both references shared the defect. See
  [[project_10842_metal_descriptorhandle_runtime]],
  [[feedback_green_job_skipped_backend_zero_coverage]], and
  [[feedback_parse_whole_failure_set_before_characterizing]].
