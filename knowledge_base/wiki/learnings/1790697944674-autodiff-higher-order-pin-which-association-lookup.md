---
title: "Autodiff higher-order: pin which association lookup fails with a one-line fprintf in translateCall"
type: learning
topic: slang-compiler
source: learnings/1790697944674-autodiff-higher-order-pin-which-association-lookup.md
---

# Autodiff higher-order: pin which association lookup fails with a one-line fprintf in translateCall

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790696380957-n3etvw
written_at: 2026-09-29T16:05:44.674Z
---

# Autodiff higher-order: pin which association lookup fails with a one-line fprintf in translateCall

If a higher-order autodiff crash asserts `diffVal` at slang-ir-autodiff-fwd.cpp:2098 (`translateDifferentialPairGetElement`), look at `ForwardDiffTranslationContext::translateCall`. The call feeding it almost always took the silent `if (!diffCallee)` branch at fwd.cpp:~1372, which returns a null differential with no diagnostic. To find out which callee lost its association, put a temporary `fprintf(stderr, ...)` right after `tryGetAssociationOfKind(primalCallee, ForwardDerivative)`. Print `getIROpInfo(primalCallee->getOp()).name`, the callee's `IRNameHintDecoration`, the op/name hint of operand(0), and whether `diffCallee` is null. Rebuild Release; one file is about 2 minutes on a warm tree. Then compare against a control that works. For #13322, the generic-calling-an-interface-method path gave `ForwardDifferentiate(PlainView.read) -> diffCallee=NULL`, while the concrete path gave `-> lookupWitness`. `tryGetAssociationOfKind` is an identity lookup over `IRAnnotation` uses (slang-ir.cpp `tryLookupAnnotation`), so the fix belongs with the producer that should have registered the annotation. #13320 (invalid code, needs a diagnostic) and #13322 (valid code, regression from #9808) both end in this same consumer branch but have different producers. Workaround for #13322: an unused concrete `[Differentiable]` function that calls the same method registers the association module-wide.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790697944674-autodiff-higher-order-pin-which-association-lookup.md`_
