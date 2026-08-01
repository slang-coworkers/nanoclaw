---
title: "slang-12284-overload-pruning-discards-beaten-local-candidate"
type: learning
topic: slang-compiler
source: learnings/1785405718177-slang-12284-overload-pruning-discards-beaten-local.md
---

# slang-12284-overload-pruning-discards-beaten-local-candidate

**Overload resolution eagerly prunes losing candidates BEFORE the winner is finalized — a naive "compare at the decision point" hook cannot see an overridden local overload.**

Context: shader-slang/slang#12284 (skiminki-nv) requested a warning for the silent-breaking-change where an imported module adds a better-matching overload that silently rebinds a call needing implicit conversion. Assessing feasibility surfaced a load-bearing constraint I verified by reading source @7c58a326b:

`SemanticsVisitor::AddOverloadCandidate` (source/slang/slang-check-overload.cpp:2525) → `AddOverloadCandidateInner` (:2442) is the single choke-point every candidate flows through. It **eagerly prunes**: when a strictly-better (lower `conversionCostSum`) candidate arrives it `fastRemoveAt`s the worse existing ones (:2465) or nulls `bestCandidate` (:2491); a strictly-worse NEW candidate is dropped outright (:2501). `CompareOverloadCandidates` (:2307) orders by status → conversionCostSum → lexical/structural tie-breakers (the "export rank / prefer non-module decl" tie-breaker only applies among EQUAL-cost candidates). The single winner is finalized at `CompleteOverloadCandidate` (:3744).

**Consequence:** in the issue's exact scenario — local `fn(int)` (uint→int, non-zero cost) vs imported `fn(uint)` (exact, cost 0) — the local candidate is *discarded before the decision point*. So any "detect that the winner is cross-module and a local candidate lost" feature must record the set of contributing candidate modules AT the choke-point (in AddOverloadCandidateInner), BEFORE pruning — not at winner selection. This is the difference between a working implementation and one that silently never fires.

**Also:** stdlib vs user-module distinction is `isFromCoreModule()` via `FromCoreModuleModifier` on ModuleDecl (module-of-decl = `getModuleDecl()` slang-syntax.cpp:1246; call-site module = `SemanticsVisitor::m_module` slang-check-impl.h:861). Any such cross-module warning MUST suppress core-module matches or it fires on nearly every implicit-conversion stdlib call (`lerp`, texture ops). Reporter noted stdlib additions are technically breaking under this rule too.

General lesson: when triaging a "warn/diagnose when overload X was chosen over Y" feature, always check whether the loser survives to the decision point — Slang's overload resolver prunes aggressively, so the info you want to diagnose on is often already gone unless captured upstream at the add/filter choke-point.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785405718177-slang-12284-overload-pruning-discards-beaten-local.md`_
