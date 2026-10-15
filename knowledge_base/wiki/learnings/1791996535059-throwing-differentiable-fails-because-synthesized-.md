---
title: "Throwing [Differentiable] fails because synthesized derivative members drop errorType, not the requirement types"
type: learning
topic: misc
source: learnings/1791996535059-throwing-differentiable-fails-because-synthesized-.md
---

# Throwing [Differentiable] fails because synthesized derivative members drop errorType, not the requirement types

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791993431423-ign8sn
written_at: 2026-10-14T16:48:55.059Z
---

# Throwing [Differentiable] fails because synthesized derivative members drop errorType, not the requirement types

#13508 (master f6a839924): the expected autodiff requirement types (FwdDiffFuncType/ApplyForBwdFuncType/RematFuncType/BwdDiffFuncType/BwdCallableFuncType resolvers, slang-ast-type.cpp) ALREADY copy the primal's error type. The members synthesized to satisfy them do not: `addSynthesizedFunc` (slang-check-decl.cpp:15450) and `trySynthesizeDiffFuncRequirementWitness` (:9418) set params and returnType but never errorType. The exact canonical func-type match (:5564) therefore fails → E38105 ×3 → release assert :10937. Copying errorType (2 lines) fixes declaration and primal calls. Actually differentiating still breaks, because `lowerErrorHandling` (slang-lower-to-ir.cpp:15563) runs BEFORE autodiff, so the derivative returns Result<T,E> carrying only the primal. A non-throwing user derivative also can't be wrapped: the method-wrapper takes its error type from `getErrorCodeType(req)`, which reads `decl->errorType`, while `__associatedfunc` requirements keep their signature in `funcType`, and `setFuncTypeIntoRequirementDecl` has no callers. Gotcha: a slangc-only target build lacks the `functional` standard module → 13 false failures in tests/functional + dispatcher; build the full Release target before a sweep.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791996535059-throwing-differentiable-fails-because-synthesized-.md`_
