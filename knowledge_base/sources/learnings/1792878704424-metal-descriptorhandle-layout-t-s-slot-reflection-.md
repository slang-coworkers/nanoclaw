---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792877407822-xa1rtd
written_at: 2026-10-24T21:51:44.424Z
---

# Metal DescriptorHandle layout = T's slot: reflection/emit mismatches for entry-point and buffer-record handles (#13900)

The rule comes from `slang-type-layout.cpp:5771-5773` (#6028): on bindless targets (CPU, CUDA, Metal) a `DescriptorHandle<T>` gets T's layout. On CPU and CUDA that layout is ordinary bytes. On Metal it is a binding slot (MetalBuffer, MetalTexture or MetalSampler) everywhere except under the Tier-2 argument-buffer rules, i.e. inside a ParameterBlock. The IR passes still treat a handle as an 8-byte value (`isResourceType` in slang-legalize-types.cpp:164 has no `IRDescriptorHandleType` arm). Measured on master 52e29ab43:
(1) A global `uniform T.Handle` becomes its own `[[buffer(n)]]` kernel argument. Layout and emit agree here.
(2) An entry-point `uniform T.Handle` param lands inside the `EntryPointParams` struct as a pointer, yet reflection gives it a slot and reports the following uniforms at offsets that are 8 bytes too low. With the handle as the only param, the struct is passed by value with no `[[buffer]]` attribute.
(3) A handle inside a `StructuredBuffer<Rec>` element is emitted as an 8-byte pointer field, but reflection gives it 0 bytes. tests/bugs/gh-6657-bindless-uniform.slang CHECK_METAL locks in that 0-byte shape.
Probe with `slangc x.slang -target metal -entry computeMain -stage compute -reflection-json r.json -o x.metal`; no GPU needed.
Also: the slang-rhi PR 802 comment saying "direct binding is intentional upstream" was posted by nv-slang-bot. It was an inference, not a maintainer decision, and the reporter later cited it. Check who wrote a comment before treating it as a design decision.
