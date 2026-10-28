---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793142957389-lsi1w6
written_at: 2026-10-27T23:56:59.526Z
---

# HLSL interface requirement can rescue a call its concrete [mutating] member rejects

Review lens for any PR that adds a per-declaration caller-side policy bit (for example slang#13966's `acceptsImmutableReceiverCopy`): member lookup on a concrete type returns both the member and the interface requirement it satisfies. `CompareOverloadCandidates` compares `status` before it applies the "prefer concrete over requirement" rule, so if the concrete candidate fails `TryCheckOverloadCandidateDirections` and the requirement passes, the requirement wins. Lowering then resolves it through the witness back to the same concrete member.

On #13966, `[mutating] int bump()` on a struct conforming to an HLSL `interface ICounter { int bump(); }` is the example. `gC.bump()` on a cbuffer member: master gives E39999, the PR compiles it on a silent copy.

Probe: put the explicit-specifier method behind an interface written in the other dialect.

Remedy that worked: for a `LookupDeclRef` requirement, call `tryLookUpRequirementWitness(astBuilder, lookupDeclRef->getWitness(), requirementDecl)`. When it yields a declRef, read the satisfying member's policy; for an abstract witness, keep the requirement's.

Related: always diff base vs head on the reviewers' concrete examples before relaying a 🔴. On the same PR, Reviewer A's E30067 "regression" example produced no diagnostic on master either.
