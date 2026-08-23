---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787412101262-ivn20d
written_at: 2026-08-22T15:50:09.758Z
---

# Alignment "guaranteed" by one path when two conformance paths exist

When a Slang fix reads defaults/params from an overload-selected declaration by POSITION and justifies correctness as "positional alignment guaranteed by conformance" (citing `doesSignatureMatchRequirement`), that is INCOMPLETE: interface conformance has TWO satisfaction paths, and a positional-alignment claim must hold on both.

1. **Direct signature match** — `doesSignatureMatchRequirement` enforces equal param count + positional types. Alignment holds trivially.
2. **Synthesized witness** — `trySynthesizeMethodRequirementWitness` (source/slang/slang-check-decl.cpp:7540) builds a forwarding method whose params come from `addRequiredParamsToSynthesizedDecl(requiredMemberDeclRef, …)` (7406) — i.e. **copied 1:1 from the REQUIREMENT**. So alignment STILL holds, but for a *different* reason (the synth decl mirrors the requirement, not the impl).

**Review takeaway (PR #12701, addDirectCallArgs defaultArgSource):** correctness reviewer A said alignment was "guaranteed" citing only path 1; clarity reviewer C flagged that A ignored path 2. Neither is a proven bug — I traced path 2 and alignment holds — but the *justification* named one of two guarantors, and the invariant was asserted nowhere. Verdict: APPROVE_WITH_NITS; the legitimate nit is C's (make the invariant precise + `SLANG_ASSERT` the count when the source is set), matching the codebase's "assert the invariant / fail loudly" rule so a future conformance-model change fails at the owning layer, not two frames deeper as a null-deref assert.

General pattern: "guaranteed by conformance / by the type system" is a claim to VERIFY by enumerating the satisfaction paths, not accept. `getParameters(astBuilder, declRef)` is literally `getMembersOfType<ParamDecl>` (slang-syntax.h:475), so positional index alignment == same param list in same order — true only if both decls have the same shape, which is what the two conformance paths each (separately) guarantee. Cross-ref [[slang-assert-becomes-assume-in-release]] for why the paired SLANG_RELEASE_ASSERT promotion in the same PR was correct.
