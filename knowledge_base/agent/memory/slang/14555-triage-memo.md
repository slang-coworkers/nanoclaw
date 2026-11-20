---
type: triage
title: "Triage: shader-slang/slang#14555 — general sourceLoc/decoration preservation through type legalization"
tags: [triage, ir, legalize-types, sourceLoc, decorations, enhancement]
---

# Triage: shader-slang/slang#14555 — A general mechanism for preserving source locations and decorations through type legalization
Date: 2026-11-19 | Enhancement | Severity: medium | Priority: P2 | Component: IR (type-legalization pass)

## What's being requested
Our own chain's filing (from the #14517 fixer chain), at explicit maintainer request — tangent-vector,
PR #14522 review comment r4603677652 (2026-11-17 18:01Z, verified verbatim): "I'd probably be fine
with landing this PR as-is, but I'd want us to open an issue for adding a more general-purpose
mechanism…". Refactor the legalizer's per-site replacement bookkeeping into one general post-process
at the pass's bottleneck, so rebuilt instructions inherit the original's sourceLoc (and, for simple
replacements, decorations) instead of dropping them.

## What the issue still covers post-#14522-merge (master a4d69f877, includes merge a22c14207 + reorg 31d233607)
- The four per-site sourceLoc copies from #14522 ARE in master and become redundant once this lands:
  `LegalCallBuilder::_emitCall` ir-passes/slang-ir-legalize-types.cpp:479; generic recreate
  `legalizeInst` :2517; `legalizePrintf` :859; `legalizeCoopMatMapElementIFunc` :2371/:2390.
- Decorations on call/printf/coopmat rebuilds are STILL dropped entirely (no transferDecorationsTo
  on those paths; originals deallocated at :3893). Only `legalizeAbort` (:940-941) and the generic
  recreate branch (:2521-2522 child-move) preserve decorations today.
- File moved by #14514: now `source/slang/ir-passes/slang-ir-legalize-types.cpp`. The bottleneck
  anchors held: `processInst` :3897, `legalizeInst` call :3933, `registerLegalizedValue` :3934.
- Unaudited additional rebuild sites drop BOTH loc and decorations: branch rebuild :771,
  `legalizeDefaultConstruct` :2032, `emitMakeStruct` :1762, `emitLoad` :788, field extract/address
  :1132/:1260/:1399, declareVars :381/:2949/:2958 (many-new-for-one decompositions).

## Semantics check — is the issue's proposal sound against the code? (verified)
- Simple (one-in/one-out): `LegalVal` flavor `simple` holds one `IRInst*` (slang-legalize-types.h:454-506);
  pairing `transferDecorationsTo` + sourceLoc copy is established in-tree precedent:
  slang-ir.cpp:9483-9490 (transfer = MOVE all decorations, insertAtStart ⇒ reversed order on target),
  paired at slang-ir-ssa.cpp:1533-1538, loop-unroll :521-522, loop-inversion :391-392, legalize-types
  :940-941, spirv-legalize :2259-2260. SOUND. Idempotent vs the generic-recreate branch (which already
  moved children at :2521-2522 ⇒ transfer from the now-empty original is a no-op).
- Multi-inst (pair/tuple/implicitDeref/wrappedBuffer, flavors at slang-legalize-types.h:48-64):
  `LegalVal` is a recursive pseudo-val tree; leaves are real IRInsts, so a loc-only-if-unset walk is
  feasible but NO existing walker exists — one must be written. No "conditional sourceLoc" helper
  exists either (sourceLoc is a plain field, slang-ir.h:562; only IRBuilderSourceLocRAII, which
  overwrites unconditionally, slang-ir.cpp:1941-1957). SOUND but new code, both trivially writable.
- Load-bearing call decorations that today get dropped: IRIgnoreSideEffectsDecoration (read by
  mightHaveSideEffects, slang-ir.cpp:9546-9549 → DCE), differentiability decorations
  (slang-ir-check-differentiability.cpp:95-96/:730), LinkageDecoration, target decorations
  (findBestTargetDecoration, slang-emit-c-like.cpp:2199). So the decoration half is latent-bug
  territory (e.g. a rebuilt side-effecting call losing IgnoreSideEffects could change DCE behavior).

## Candidate approaches
### Approach A: bottleneck post-process (the issue's proposal) — RECOMMENDED
- Where: source/slang/ir-passes/slang-ir-legalize-types.cpp:3933-3934 (`processInst`, after
  `registerLegalizedValue`); new helper `transferSourceLocAndDecorationsToLegalizedInst(inst, legalVal)`
  in the same file (or slang-legalize-types.cpp); new recursive LegalVal leaf-walker.
- Behaviour delta: simple → loc (only-if-unset) + transferDecorationsTo; pair/tuple → loc-only-if-unset
  on all leaves; then DELETE the per-site copies (:479, :2517, :859, :2371, :2390; legalizeAbort's
  :940-941 becomes redundant too). Also catches the unaudited decomposition sites for loc.
- Tradeoffs: one choke point, matches maintainer's stated design; deletes ~6 hand-rolled copies;
  broadest behavior change (decorations now survive where previously silently dropped — expect some
  downstream test diffs, which are the fix, not regressions).
- Risk (design subtleties the fixer must resolve):
  (1) ORDER vs the driver: processInst requeues users/children (decorations included) after
  registerLegalizedValue, then frees originals at :3877-3894 — transferring decorations off the
  original BEFORE the child-requeue scan would hide decoration insts from requeueing; safest is to
  run the post-process after the requeue scan but before cleanup.
  (2) IRSynthesizedParameterGroupDecoration precedent (slang-legalize-types.cpp): after a transfer,
  code had to RE-ADD a decoration to the original because a later diagnostic reads it off the
  original — a general transfer needs an audit for readers between register and dealloc.
  (3) transferDecorationsTo reverses decoration order and moves (not copies) — probably harmless,
  note in PR.
### Approach B: per-site hardening only (extend #14522's approach)
- Where: add transferDecorationsTo at :479/:859/:2371/:2390 + audit :771, :2032, :1762, :788…
- Behaviour delta: minimal, local. Tradeoffs: perpetuates exactly the hand-rolling the maintainer
  wants removed; every future rebuild site can forget again.
- Risk: low per-change, high residual (issue's whole point). Ruled out by maintainer direction.
### Approach C: builder-level mechanism (IRBuilderSourceLocRAII-style "replacement" API)
- Where: slang-ir.cpp:1941-1957 + LegalCallBuilder.
- Behaviour delta: catches every emit in scope. Tradeoffs: decorations aren't a builder concept;
  multi-inst flavors would wrongly decorate intermediate temporaries; touches shared IR infra used
  by all passes. Risk: high blast radius for no gain over A. Ruled out.

## Recommended path (solution brief)
Approach A. Hypothesis: a single post-process at processInst (:3933-3934) can and should own
loc+decoration bookkeeping. Suspected files: ir-passes/slang-ir-legalize-types.cpp:3933-3934 (wire),
:479/:859/:2371/:2390/:940-941/:2517-2522 (delete per-site copies), slang-legalize-types.h:454-506
(LegalVal walker), slang/ir/slang-ir.cpp:9483 (primitive, unchanged). Repro command: none required
for the refactor itself — pin with (1) existing pinning test tests/spirv/resource-selection-call-locations.slang
(#14522) still passing, (2) NEW test: a resource-keyed call carrying a load-bearing decoration
(e.g. [IgnoreSideEffects]/[TreatAsDifferentiable]) retains it on the rebuilt call, (3) a pair/tuple
legalization (mixed ordinary/resource struct arg) yields located diagnostics. Accept when: helper
landed, per-site copies removed, those three tests pass, full slang-test run shows only expected
decoration-survival diffs. Alternatives + risks: memo above (order-vs-requeue, re-add-after-transfer
readers, order reversal).

## Classification
Category: enhancement (maintainer-requested refactor; decoration half is latent correctness).
Severity: medium. Priority: P2. Component: IR. Duplicate: no (searched; only #14555 tracks this).
Issue Type already `Feature` (correct — no change). Label "Tess's Label" = repo default funnel label,
not human triage; leaving labels untouched. Assignee tangent-vector (the requesting maintainer) — correct.

## Sources
- Issue body + tangent-vector comment r4603677652 (verified via gh api, 2026-11-17).
- Local master a4d69f877 post-merge verification (two code subagents, 2026-11-19): all anchors above.
- DeepWiki Q&A (2): work-list driver + LegalVal flavors; transferDecorationsTo semantics +
  IRSynthesizedParameterGroupDecoration re-add precedent.
- Shared wiki: slang-compiler-ir-type-legalization.md (#14517 family), slang-backends-cuda-active-mask-and-ballots.md
  (transferDecorationsTo+sourceLoc pairing precedent).
- Chain record: memory/issues/14517.md (this issue's provenance).
