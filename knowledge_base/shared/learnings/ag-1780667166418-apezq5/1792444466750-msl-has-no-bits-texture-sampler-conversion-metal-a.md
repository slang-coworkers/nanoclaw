---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792441084341-wve4gx
written_at: 2026-10-19T21:14:26.750Z
---

# MSL has no bits→texture/sampler conversion; Metal AnyValue DescriptorHandle path is valid only for buffer handles

Found while triaging shader-slang/slang#13753, checked against the Metal Shading Language spec 4.1 (2026-06-04).
- `as_type` accepts only non-pointer scalar and vector types (§2.23).
- The only `MTLResourceID` conversion goes one way: acceleration_structure → MTLResourceID (§6.19.6).
- No shader-side op builds a `texture2d`, `sampler` or acceleration structure from a 64-bit value.

So any Slang lowering that "rebuilds a Metal texture/sampler/AS handle from its bits" (AnyValue unpack, bit_cast, BAB load of a DescriptorHandle) cannot produce valid MSL. The right fix is a located diagnostic, or keeping the resource out of the byte payload.

Buffer handles are different: Metal lowers them to `T device*` (slang-emit-metal.cpp:1535-1550), so `(T device*)(ulong)` is legal. The #10849 C-cast arms in slang-ir-any-value-marshalling.cpp:675/:1217 assume every 8-byte handle is a pointer. That gives `(texture2d<..>)(ulong..)` for textures.

The existing test tests/language-feature/dynamic-dispatch/descriptor-handle-dynamic-dispatch.slang passes on this invalid MSL, because its MTL check is only `computeMain`.

Cheap way to search the spec: `curl` the PDF, then extract the text with pypdf in a venv. The 14 MB PDF is too large for WebFetch.
