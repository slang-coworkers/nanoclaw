---
type: chain
title: slang#14166 — Metal ROV inside a ParameterBlock gets no `[[raster_order_group]]` (also in fragment)
description: Bot-filed 2026-11-02 10:31Z by slang-triager as a side bug of the #14160 triage. Issue Type=Bug + `reproduced`, 0 comments. Not dispatched; a fixer chain needs the operator's OK.
tags: [metal, emit, rov, rasterizer-ordered, parameter-block, descriptor-handle, bug, side-bug]
---

# slang#14166 — ROV in a ParameterBlock loses raster ordering on Metal

**Ask.** `ParameterBlock<Params>` with `RasterizerOrderedStructuredBuffer<int>` / `RasterizerOrderedTexture2D<float4>`
members: the argument-buffer struct members get no `[[raster_order_group(0)]]`, even in a fragment function, and there is
no diagnostic. SPIR-V (interlock) and HLSL (ROV globals) keep the ordering. MSL 4.1 §5.2.1.2 allows the attribute on
argument-buffer members. Cause: the field type is `DescriptorHandle(ROV)`, which the type-only hook
`MetalSourceEmitter::emitPostDeclarationAttributesForType` (slang-emit-metal.cpp:1780-1796) does not unwrap.

**Provenance.** Filed by slang-triager (session `sess-1793614055936-6fox1k`) during the
[#14160](14160-metal-raster-order-group-compute.md) triage. That issue is under R6, so this filing does not name it. The
triager's report: "Filed only; ask before any fixer chain." Shared learning:
`/workspace/shared/learnings/ag-1780667166418-apezq5/1793615545691-rasterizer-ordered-resources-stage-rules-per-targe.md`.

**Coupling.** Same emit hook as #14160 (whose fix gates the attribute on the fragment stage). A #14166 fix must not mark
members for non-fragment users of the struct (open question in the issue). The fixes are best done together, or in sequence.
#14160 is held to 2026-11-06T10:04:38Z and the reporter may open their own PR. Also related: #13796 (maintainer-owned).

**Dispatch (11-02, Orchestrator).** `issue_opened` webhook: memory grep found no record. The live sessions show that the
#14160 triager chain owns it, so I sent no triager dispatch. Bot-filed, so R6 does not apply.

**Open.** Fixer chain: wait for the operator's OK. The #14160 Main session asked the operator on 11-02, so this session sent no second ask. Bundle with #14160 after its R6 release if the reporter does not take it.
