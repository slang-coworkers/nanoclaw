---
title: "slang autodiff: inverse-direction derivative placement registers an association, not a primal modifier — capability/propagation passes must consult getAssociatedDeclsForDecl"
type: learning
topic: slang-compiler
source: learnings/1781170088020-slang-autodiff-inverse-direction-derivative-placem.md
---

# slang autodiff: inverse-direction derivative placement registers an association, not a primal modifier — capability/propagation passes must consult getAssociatedDeclsForDecl

Context: triaging shader-slang/slang#11551 (`[require(cap)]` on a derivative declared via the INVERSE placement `[ForwardDerivativeOf(primal)]`/`[BackwardDerivativeOf(primal)]` was silently dropped — no E36107). Verified at HEAD 607bb020e by two code-reader subagents + an independent codex read-only pass (all agreed).

Key non-obvious facts (file:line @ source/slang):
- The two derivative-association placements are NOT symmetric in the AST. FORWARD placement (`[ForwardDerivative(fn)]`/`[BackwardDerivative(fn)]` on the primal) lives as a `UserDefinedDerivativeAttribute` *modifier* on the primal (slang-ast-modifier.h:1823/1832/1869). INVERSE placement (`[ForwardDerivativeOf]`/`[BackwardDerivativeOf]` on the derivative) is a `DerivativeOfAttribute` (1838/1852/1877) on the DERIVATIVE; checking it (`checkDerivativeOfAttributeImpl`, slang-check-decl.cpp:18048) synthesizes a transient `BackwardDerivativeAttribute` (:18169) that is checked but NEVER `addModifier`'d onto the primal — only `registerAssociatedDecl(primal, BackwardDerivativeFunc, derivative)` (:18190) persists.
- CONSEQUENCE: any pass that wants to see "the derivatives of this primal" via `getModifiersOfType<UserDefinedDerivativeAttribute>()` will MISS all inverse-placed derivatives. The robust, placement-agnostic way is the association registry: `getAssociatedDeclsForDecl(decl)` (decl slang-check-impl.h:842, def slang-check-decl.cpp:16776) filtering `DeclAssociationKind::{ForwardDerivativeFunc,BackwardDerivativeFunc}` (slang-ast-support-types.h:1671). BOTH placements register the same association kind, so one association-based loop unifies them. (Mirrors the prior learning that autodiff variant lookups should use the association API, not raw decoration iteration.)
- PASS ORDERING (often misanalyzed): the module driver `ensureAllDeclsRec`/`states[]` (slang-check-decl.cpp:5091/5132) advances ALL decls through each `DeclCheckState` globally before any advances to the next. So `ReadyForLookup` (where `SemanticsDeclDifferentialAttributesVisitor` registers the inverse association) completes for the whole module before any decl reaches `CapabilityChecked` (`SemanticsDeclCapabilityVisitor`, :19703). ⇒ Consulting associations from the capability visitor needs NO reordering. Per-decl `ensureDecl` worries are moot at module scope; you still call `ensureDecl(derivative, CapabilityChecked)` to force the derivative's own `inferredCapabilityRequirements` before unioning.

Triage process note: the issue's "root cause" referenced PR #11524's code, but #11524 was still OPEN/unmerged — at HEAD neither forward NOR inverse placement was capability-checked. Always verify a follow-up issue's premise against actual master HEAD; a fix for issue N may be logically stacked on an unmerged PR, which changes the handoff (base on the PR branch, not bare master).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781170088020-slang-autodiff-inverse-direction-derivative-placem.md`_
