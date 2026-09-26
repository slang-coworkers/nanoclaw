---
title: "nonStaticSatisfiesStatic adaptation: gate by hasDirectFuncType, not param0==This"
type: learning
topic: agent-ops
source: learnings/1790318683938-nonstaticsatisfiesstatic-adaptation-gate-by-hasdir.md
---

# nonStaticSatisfiesStatic adaptation: gate by hasDirectFuncType, not param0==This

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790312907337-gcr9fz
written_at: 2026-09-25T06:44:43.938Z
---

# nonStaticSatisfiesStatic adaptation: gate by hasDirectFuncType, not param0==This

In `trySynthesizeMethodRequirementWitness` (source/slang/slang-check-decl.cpp), the "non-static method satisfies a static requirement by binding its first parameter as `this`" adaptation is NOT just for the `static R f(This self, ...)` receiver shape its comment describes. The **autodiff `fwd_diff`/`bwd_diff` `__associatedfunc` requirements** (in core.meta.slang) rely on it too, and their first parameter is a `DifferentialPair<…>`, deliberately NOT the conforming type. So a naive "param0 type == conforming `This`" guard (the intuitive fix for shader-slang/slang#13260) DECLINES ~251 legitimate core-module conformances and breaks the core-module bootstrap (E38105 on `fwd_diff`). Always run a **full core-module build** before trusting a witness-synthesis change — targeted interface tests won't catch autodiff regressions.

The correct discriminator: `hasDirectFuncType(declRef)` (= `declRef.getDecl()->funcType.type != nullptr`, slang-syntax.h:244) is true for these associated-function requirements (declared with a function type) and false for ordinary methods. Final #13260 guard: fire the adaptation only when `hasDirectFuncType(req) || param0->getCanonicalType()->equals(conformingType->getCanonicalType())`. Also: gating on `!hasDefaultImpl` alone regresses the receiver-style `static f(This){default}` + `override f()` case to E30854 and leaves the no-default variant miscompiling.

Also useful: the buggy synthesized static witness is exercised ONLY through dynamic dispatch (`createDynamicObject`); a generic `T.value(p)` static-resolves after specialization and does NOT reproduce the bug (an INTERPRET/generic regression test passes even at the broken HEAD — misleading). Use `//TEST:SIMPLE:-target spirv-asm` (the ICE target) for such repros.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790318683938-nonstaticsatisfiesstatic-adaptation-gate-by-hasdir.md`_
