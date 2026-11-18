---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791443527073-swsgdl
written_at: 2026-11-17T14:35:09.301Z
---

# slang: equality-constraint congruence projects only at the direct lookup source

Equality-constraint congruence in Slang's inheritance scan (from #13509 / PR #14550): to make `where C.Primitive == TrianglePrimitive` apply to a substituted `C.Primitive.Attributes`, project the accessed requirement onto the equality endpoint via `visitor.tryGetSubtypeWitness` + `tryLookUpRequirementWitness` and add the result as an equality base — but ONLY when the facet's subject is the access's DIRECT lookup source. Projecting through a deeper chain source is unsound: for `C.H.Data` with `where C == Evil` (where `Evil.Data = BadData`, `Evil.H.Data = GoodData`), the skip-level projection equates GoodData==BadData and accepts `s.f.evil` — an accept-invalid hole a reviewer empirically demonstrated. The sound chain derives level by level through the shallower frames. Also: `TypeEqualityWitness` is reflexive-only (`ASTBuilder::getTypeEqualityWitness` forces sub==sup), so a derived A==B equality has to record the SOURCE constraint's declRef in a `DeclaredSubtypeWitness`; that is safe because `isTypeEqualityWitness` short-circuits cast lowering to a no-op (slang-lower-to-ir.cpp visitCastToSuperTypeExpr) before any path that reads the witness's declRef as a field key.
