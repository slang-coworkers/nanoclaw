---
title: "Empty input struct erases the whole GS input param on ALL non-CPP targets (incl. HLSL), not just SPIR-V/GLSL"
type: learning
topic: slang-compiler
source: learnings/1789987486527-empty-input-struct-erases-the-whole-gs-input-param.md
---

# Empty input struct erases the whole GS input param on ALL non-CPP targets (incl. HLSL), not just SPIR-V/GLSL

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789985222851-qj2ccb
written_at: 2026-09-21T10:44:46.527Z
---

# Empty input struct erases the whole GS input param on ALL non-CPP targets (incl. HLSL), not just SPIR-V/GLSL

From reviewing shader-slang/slang#13195 (geometry shader empty input element struct loses input primitive topology).

**Fact (source-traced):** An empty input struct legalizes to `LegalType::none` (slang-legalize-types.cpp ~491-497), so `legalizeParam` erases the *entire* IR parameter (slang-ir-legalize-types.cpp ~2303-2321). `shouldLegalizeExistentialAndResourceTypes` is disabled only for CPP/C/CUDA (slang-emit.cpp ~3050-3060) — meaning `legalizeResourceTypes` runs for HLSL too. Consequence: any decoration read off the *parameter* at emit time is lost for the empty-struct case on **every** target except CPP/C/CUDA.

**Why it matters for GS topology:** `IRGeometryInputPrimitiveTypeDecoration` was originally only on the IR param. SPIR-V/GLSL read it off the *function* (via a late param→func lift in ir-glsl-legalize), HLSL reads it off the *param* (slang-emit-hlsl.cpp:2437). The principled fix (PR #13195) records the topology on the entry-point `IRFunc` at lowering (mirroring `[maxvertexcount]`/`[instance]`) so it survives param erasure. But note: keeping the *param* copy "for HLSL" does NOT rescue the HLSL empty-struct case — the HLSL param is erased too, so HLSL empty-struct GS input remains a separate, unaddressed limitation. A "kept for HLSL" rationale on such a param-copy is misleading for empty structs.

**Review-methodology note:** a byte-equivalent correctness run (Reviewer A) had its own subagents *disagree* on whether the HLSL param survives — resolve such disagreements by source-tracing legalizeResourceTypes / shouldLegalizeExistentialAndResourceTypes rather than trusting DeepWiki (which is known-unreliable on "is this decoration removed here"). Confirm emitted text with an actual `-target hlsl` compile when possible.

**Also observed:** the paired `SLANG_UNEXPECTED`→`SLANG_RELEASE_ASSERT` flip in the param→func lift is *necessary*, not cosmetic — once lowering pre-populates the func decoration, the old SLANG_UNEXPECTED would fire on every valid non-empty geometry shader. The retained `else`-lift branch is then unreachable for freshly-lowered modules (only plausibly reached when linking older serialized IR predating the hoist) — flag as name-the-input-or-assert per the repo's dead-code discipline.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789987486527-empty-input-struct-erases-the-whole-gs-input-param.md`_
