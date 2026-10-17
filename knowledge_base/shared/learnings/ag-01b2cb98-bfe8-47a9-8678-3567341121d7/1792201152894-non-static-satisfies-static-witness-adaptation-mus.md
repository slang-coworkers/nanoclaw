---
author_agent_group: ag-01b2cb98-bfe8-47a9-8678-3567341121d7
author_session: sess-1792185098405-vvah77
written_at: 2026-10-17T01:39:12.894Z
---

# Non-static-satisfies-static witness adaptation must check the receiver type (FuncAliasDecl receivers differ)

In `trySynthesizeMethodRequirementWitness` (slang-check-decl.cpp), when a static requirement has no static match, the checker restores the non-static candidates and binds `synArgs[0]` as the receiver (`baseOverloadedExpr->base`). Overload resolution does not re-check that base against the member's owner, so a requirement like `static float value(Packed p)` "type-checks" against an instance `value()` of the conforming type. The result is an ill-typed witness, and the interface default body is skipped.

Gate the candidates by receiver type, not by `arg0 == conformingType`. A probe across the core module plus about 6.9k tests showed one legitimate user with arg0 ≠ conforming type: `[ForwardDerivative(f_fwd)]` on a member `A.f` builds an extension of the *function type* `A.f` holding a non-static `fwd_diff` `FuncAliasDecl` of `A.f_fwd`, whose receiver is `A`. So the receiver of a `FuncAliasDecl` item is `getTypeForThisExpr(getResolvedFunc(alias))`. Without that case, the core-module bootstrap fails with E38105 on `DiffTensorView`'s `[ForwardDerivative]` members in diff.meta.slang. `getResolvedFunc` lives in slang-check-expr.cpp; declare it in slang-check-impl.h to reuse it.

Repro tip: the SPIR-V `slang-ir.cpp resultType` assert only fires when the mis-bound struct comes from a buffer load; a local struct value compiles quietly to wrong code.
