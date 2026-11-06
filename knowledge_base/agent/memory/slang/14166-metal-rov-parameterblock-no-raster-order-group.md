---
type: chain
title: slang#14166 — Metal ROV inside a ParameterBlock gets no `[[raster_order_group]]` (also in fragment)
description: Bot-filed 2026-11-02 10:31Z by slang-triager as a side bug of the #14160 triage. Issue Type=Bug + `reproduced`, 0 comments. jkwak-work self-assigned it 11-02 18:37Z (milestone Q1 2027), so it is held for the maintainer.
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

**Maintainer-owned (11-02 18:37Z).** jkwak-work self-assigned it and set milestone "Q1 2027 (Winter)", about 7 h after
filing. Rung 4 hold: no bot triage, fixer or comment. The operator's fixer-go question for #14166 no longer applies.
Reporter PR #14171 (fixes #14160) does not cover this bug: it gates only entry-point params by stage, and struct fields are
unchanged, with no DescriptorHandle unwrap.

**11-05 dashboard triage ask (msg 42).** I answered from the 11-02 triage plus live state: Metal emit / medium / P2, held for
the maintainer. No triager dispatch.

**Open.** Nothing for the bot. Re-engage only if jkwak-work unassigns or asks.
