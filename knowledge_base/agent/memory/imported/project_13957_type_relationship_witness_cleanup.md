---
type: project
name: project_13957_type_relationship_witness_cleanup
description: "slang#13957 (tangent-vector, 10-26 19:50Z, self-assigned): maintainer design proposal to split SubtypeWitness/InheritanceDecl/TypeConstraintDecl into TypeRelationshipWitness/BaseTypeDecl/TypeRelationshipDecl plus a TypeRelation Val hierarchy and check-vs-query operations. Asks nothing of the bot -> held: NO dispatch, NO bot post."
---

# slang#13957 — clean up the representation of type-relationship witnesses

**10-26 19:50Z, `issue_opened`.** Live read: OPEN, author **tangent-vector**, self-assigned 4 s after
filing (timeline actor: the author), no labels, 0 comments, no milestone. Body (~13.8 KB) matches
the payload.

The proposal has four parts:

1. Renames: `TypeConstraintDecl` → `TypeRelationshipDecl`, `InheritanceDecl` → `BaseTypeDecl`,
   `SubtypeWitness` → `TypeRelationshipWitness`, sub/sup → lhs/rhs.
2. A new `TypeRelation` `Val` hierarchy: implicit convertibility, subtype, equality, contract
   conformance, contract refinement, enum tag type, struct extension.
3. Witness subclasses describe the proof, not the relation, with a `TypeRelationshipWitnessRef<R>`
   smart pointer.
4. Separate `check…` operations (diagnose and return an error witness) from `does…` query
   operations (return null, no diagnostic), and audit every call site that currently asks for a
   subtype witness.

Folding implicit conversion (`tryCoerceImpl`) into the same hierarchy is an optional follow-up.

**Disposition: held, nothing dispatched or posted.** This is the same class as
[[project_13956_name_lookup_overload_resolution_overhaul_202c]] and
[[project_13719_unqualified_name_lookup_umbrella]]: a maintainer owns this design refactor, it
does not read as a bug report, and it asks nothing of the bot.

**Resume** only on a comment that @-mentions @nv-slang-bot, or on an operator ask. Mentions arrive
as webhooks, so this chain needs no re-chase timer.
