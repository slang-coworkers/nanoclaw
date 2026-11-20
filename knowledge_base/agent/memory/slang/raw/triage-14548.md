---
type: triage
title: "Triage: shader-slang/slang#14548 — [require] on variables is not enforced"
---
# Triage: shader-slang/slang#14548 — [require] on variables is not enforced
Date: 2026-11-17 | Category: bug | Severity: medium | Priority: P2 | Component: frontend (capability check)
Reproduced on master 2a91af5b7 (freshly rebuilt release slangc). Issue Type `Bug` + `reproduced` label set at filing. Duplicate: no (deduped 4 phrasings, zero hits). Parent GO on substance 13:42Z; dispatch HELD pending critique-gate stability (queues behind #14524, #13837, #14292, #14518-R2, #13833).

## What's broken
A `[require]` on ANY variable — free global const, or static const data member (generic or not) —
is silently unenforced: a consumer referencing it compiles clean for targets the variable does not
support. Same defect class as #14430 (declared requirements never reaching the join), but a
different mechanism: population-side, not reference-side.

## Repro (re-verified 2026-11-17 13:50Z on master 2a91af5b7, freshly rebuilt release slangc;
## scratch at /workspace/agent/scratch/capfind/)
varfree.slang: `[require(spirv)] static const float w` + `export float a() { return w; }` →
`slangc varfree.slang -target hlsl -entry a -stage compute` → exit 0; expected E36107.
membervar.slang / membervar-generic.slang: same shape as `static const float v` inside
`struct G` / `struct G<T>` (`G.v` / `G<float>.v`) → exit 0; expected E36107.
Control: identical `[require(spirv)]` on a function in the same position → E36107 (enforced).

## Codebase digest (file:line, re-verified on-disk 2026-11-17 13:50Z, master 2a91af5b7)
- checkVarDeclCommon (slang-check-decl.cpp:23064-23079): seeds mutableCapSet from the (empty)
  inferredCapabilityRequirements, walks referenced decls, freezes — NEVER calls
  getDeclaredCapabilitySet(varDecl) and never merges the var's own [require] modifiers.
  Consumers (processReferencedDecl → handleProcessFunc, :22621) therefore join an empty set.
- Walk detail (correction to the issue body's "(its type, initializers)"): the walk covers
  `varDecl->type.type` ONLY (:23069) — the initializer is NOT walked. That is deliberate:
  initializer visiting was tried on PR #14332 and REVERTED (broke tests/bugs/13074 HLSL `&` in
  static resource initializers, 13107 CUDA DescriptorHandle.init).
- Subtlety the fixer will hit: the var's own `[require]` IS passed into visitReferencedDecls as
  `maybeRequireCapability` (:23071), but that parameter is consumed ONLY by
  visitTargetSwitchStmt/StageSwitch case-compatibility validation (:22840-22886) — never merged
  into the inferred set. The merge must be added in checkVarDeclCommon itself, after the walk.
- The function path IS the model: checkFunctionCommon (slang-check-decl.cpp:23262-23317) does
  `declaredCaps = getDeclaredCapabilitySet(funcDecl)`; if non-empty → public decls must declare a
  superset of inferred (enforced via CapabilitySet::checkCapabilityRequirement +
  diagnoseUndeclaredCapability; inferred = declared); internal decls join inferred ∪ declared.
- getDeclaredCapabilitySet (:23081-23135) already handles decl + parent-chain requires.

## Traps for the fixer (from /workspace/shared/wiki — hard-won prior art)
- Do NOT also enable initializer visiting in checkVarDeclCommon in this fix: reverted from PR
  #14332 for breaking 13074/13107; it "needs its own design" (wiki:
  slang-language-core-struct-field-and-type-capability-gating.md).
- The merge target is the VAR's own inferredCapabilityRequirements — safe (a var has no members;
  consumers join it as requirements). NEVER fold anything into a parent STRUCT's
  inferredCapabilityRequirements: getDeclaredCapabilitySet reads a parent AggTypeDecl's
  inferred set as the declared set of its methods/members → E36104 (same wiki page).
- Closing one capability gap exposes stale [require]s elsewhere (wiki #14332): after the change,
  full-build every target with standard modules (`-k 0`) and grep each target log for
  `(error|warning)[E…]`; also run a WGSL+Metal compile-only sweep of //TEST lines, master vs fix,
  and diff every SIMPLE directive's raw output. Grep meta.slang sources: no in-tree variable
  currently carries [require] (verify by compiling the core module for hlsl/metal/spirv/cuda).

## Recommended path (single approach — constraint that rules out others below)
In checkVarDeclCommon, mirror the function path: after the visitReferencedDecls walk, obtain
`declaredCaps = getDeclaredCapabilitySet(varDecl)`; if non-empty, apply the same public/internal
split (public: enforce superset via CapabilitySet::checkCapabilityRequirement + diagnoseUndeclared
Capability; inferred = declared; internal: join) and freeze into inferredCapabilityRequirements.
Acceptance: all three repros above emit E36107 exit 255; control function case unchanged; core
module still compiles (grep shows no meta.slang variable currently carries [require] — verify by
compiling the core module for hlsl/metal/spirv/cuda in the PR); add a diagnostics test with the
free-var and member-var repros (+ generic spelling) expecting E36107.

## Alternatives / risks
- Reference-side fix (join declared caps at every consumer read) — rejected: duplicates the
  merge logic at N call sites; population-side is the single source of truth.
- Minimal "join only" without the public-superset enforcement — would match internal semantics
  but leave public API vars unenforced for declared-vs-used conflicts; the function split is the
  established precedent, deviating needs a maintainer reason.
- Risk: none measured — no in-tree [require]-carrying vars found, so blast radius is new
  enforcement only (user code declaring [require] on vars currently gets silence).

## Sources
- Filing #14548 (mine, 2026-11-17) with reproducer + root cause; subagent digest (task
  ses_e164d58ffffe...) re-verified by direct code read + fresh runs by me.
- Related: #14430 / PR #14540 (reference-side sibling fix, independent); parent GO ruling msg 36.
