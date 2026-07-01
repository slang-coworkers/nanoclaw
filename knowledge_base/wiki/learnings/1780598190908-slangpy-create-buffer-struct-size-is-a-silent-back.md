---
title: "SlangPy create_buffer struct_size is a silent backend-layout footgun — use resource_type_layout"
type: learning
topic: slang-compiler
source: learnings/1780598190908-slangpy-create-buffer-struct-size-is-a-silent-back.md
---

# SlangPy create_buffer struct_size is a silent backend-layout footgun — use resource_type_layout

From triage of shader-slang/slangpy#1014 (Metal vs Vulkan execution discrepancy with `RWStructuredBuffer<Tup{int2;float4}, ScalarDataLayout>`).

**Finding.** `device.create_buffer(element_count=n, struct_size=K)` allocates exactly `n*K` bytes and NEVER reconciles `K` against the Slang-emitted device-side element stride. The stride that indexes `buffer[i]` in-shader is baked entirely into the compiled backend code (e.g. MSL/SPIR-V) by Slang codegen per target; slang-rhi binds the buffer as a bare pointer + byte offset and never sees an element stride (`external/slang-rhi src/metal/metal-shader-object.cpp` structured buffers go through the `MutableRawBuffer` path). So if the user hard-codes a `struct_size` that's smaller than the device stride on some target, you get **silent out-of-bounds**, not an error — and the debug layer does NOT catch shader-driven structured-buffer indexing (only explicit copy/subresource ranges). Symptom: correct on one backend, corrupted/black regions on another.

**The escape hatch.** Pass `resource_type_layout=program.reflection.<bufferParam>` to `create_buffer` instead of `struct_size=`. SlangPy then derives `struct_size = element_type_layout()->stride()` — the per-target reflected stride (`src/sgl/device/resource.cpp:66-91`). Proven by `slangpy/tests/device/test_buffer_from_resource_type_layout.py` (a struct reflects struct_size==32; float4→16; uint→4). This is the only host-side way to get a backend-correct allocation; a hard-coded number is a guess.

**Caveat.** This only saves you if Slang reflection and Slang codegen agree on the stride for that target. If they disagree (reflection says 24 but Metal codegen indexes 32), even `resource_type_layout` can't help — that's an upstream Slang bug. Pairs with the existing learning on per-target `ScalarDataLayout` stride (1780177237717): ScalarDataLayout is honored differently per target, and DeepWiki is unreliable on the Metal case — verify against emitted MSL / reflected stride, not DeepWiki.

**Why it matters for triage:** when a SlangPy issue is "same program, different result across backends" involving a manually-sized structured buffer, the host/device stride mismatch is a prime suspect, and the fix may be as simple as switching to `resource_type_layout=` (no code change) rather than a compiler fix.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780598190908-slangpy-create-buffer-struct-size-is-a-silent-back.md`_
