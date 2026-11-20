---
type: triage
---
# Triage: shader-slang/slang#14537 — Internal error at slang-ir.cpp:9100 when an existential box dispatches a two-level inherited requirement
Date: 2026-11-17 | bug | high | P2 | frontend (witness representation; crash manifests in IR/typeflow specialize) | Duplicate: no

## What's broken / being requested
Dispatching a requirement inherited TWO interface levels up (`IRoot.read` through `IBase<int>` <- `IDerived`) through an existential box (`IDerived d = s; d.read()`) aborts the compiler: `SLANG_ASSERT(other)` at slang-ir.cpp:9100 in `_replaceInstUsesWith`. One-level (direct base) dispatch works. No generics constraints, no autodiff, no conjunction, no default methods.

## Repro (VERIFIED by me, fresh builds at HEAD 2a91af5b7, 2026-11-17)
```
/workspace/agent/slang/build/Debug/bin/slangc repro.slang -target cuda -stage compute -entry computeMain -o out.cu
  -> error[E99997]: assert failure: slang-ir.cpp(9100): other
```
- Repro source: /workspace/agent/tmp/issue-14537/repro.slang (verbatim from issue); one-level control: one-level.slang (compiles clean).
- Target-independent: identical abort on spirv-asm, hlsl, wgsl, cuda (Debug).
- Release build (assert compiled out): **segfault** (exit 139) — hard crash in shipping config, not a silent miscompile as first thought.
- `reproduced` label + Issue Type=Bug applied (no prior human triage: 0 labels, 0 comments).

## Codebase digest (file:line at HEAD 2a91af5b7)
- Assert: slang-ir.cpp:9100 `SLANG_ASSERT(other)` in `_replaceInstUsesWith` (def :9064); `other` = replacement target of the dedup worklist — null iff a caller passed nullptr to `replaceUsesWith`.
- Null producer (crash site): slang-ir-typeflow-specialize.cpp:5945 — `specializeLookupWitnessMethod` concrete-table branch: `inst->replaceUsesWith(findWitnessTableEntry(witnessTable, inst->getRequirementKey()))` — UNGUARDED. Legacy twin is guarded: slang-ir-specialize.cpp:1337-1362 (`if (!satisfyingVal) return false;`). Same unguarded shape at slang-ir-translate.cpp:348 and analysis-side :3539.
- Lookup helper: `findWitnessTableEntry` slang-ir-util.cpp:2221-2235 — flat pointer-equality key match, no inheritance chase.
- Root cause (FACT-anchored hypothesis, 3 independent paths agree): checker facet merger `_specializeInterfaceInheritanceWitness` (slang-check-inheritance.cpp:452-480) can emit a COMPRESSED `DeclaredSubtypeWitness(sub=IDerived, sup=IRoot, declRef=IBase<T>.$inheritance)` (declRef parent != sub); shape documented valid-for-facets but malformed-for-IR (slang-check-impl.h:3703-3718). The method-call lookup path records the facet witness verbatim in the SuperType breadcrumb (slang-lookup.cpp:508-515) and never normalizes; `normalizeSubtypeWitnessForInterfaceUpcast` (slang-check-conversion.cpp:3344-3403) is only called on the interface-upcast path (:2415-2418). Lowering the compressed witness emits `lookupWitness(wt_S:IDerived, IBase.$inheritance)` — but the S:IDerived table only holds the `IDerived.$inheritance` key (nested tables, slang-lower-to-ir.cpp:10953, :10770-10817) → flat miss → nullptr → assert. One-level works because the direct-base key matches the table.
- DeepWiki corroborates: upcast contract = one lookupWitness per inheritance edge; breadcrumb path bypasses normalization.
- Distinct families (verified): #12814/#11487 stale-`conformingWitness` (needs DEFAULT methods; PR #12818) — different producer; typeflow ExtractExistential ICEs #12934/#13046/#13259 (PR #12935 `isRefinedInfoType` guard) — different assert/function. #12873 conjunction lookup — unrelated.

## Candidate approaches
### Approach A (RECOMMENDED): normalize the compressed witness on the method-call lookup path (producer-side)
- Where: record/consume the SuperType breadcrumb facet witness — slang-lookup.cpp:508-515; reuse `normalizeSubtypeWitnessForInterfaceUpcast` (slang-check-conversion.cpp:3344-3403) or fix `_specializeInterfaceInheritanceWitness` (slang-check-inheritance.cpp:452-480) to emit a proper transitive chain.
- Behaviour delta: lowering emits one lookupWitness per edge (IDerived.$inheritance -> IBase<int> table -> IBase.$inheritance -> IRoot table -> IRoot.read), each key present in its table; both levels resolve.
- Tradeoffs: fixes the representation, benefits every downstream consumer; normalization helper already exists and is proven on the upcast path (test: interface-to-interface-upcast.slang, #10156).
- Risk: touches facet machinery used by all lookups — needs the full dynamic-dispatch + lookup test sweep; must confirm no perf/pathology when normalization is a no-op.
### Approach B: guard the typeflow consumer at slang-ir-typeflow-specialize.cpp:5945 (mirror slang-ir-specialize.cpp:1361)
- Behaviour delta: converts abort into unresolved lookup (likely downstream ICE or wrong code) — a mask, not a fix. At best defense-in-depth with a diagnostic.
- Tradeoffs: tiny blast radius but leaves the malformed lookup chain in IR; Release segfault likely persists in some other consumer (:3539, slang-ir-translate.cpp:348).
- Risk: do-not-mask anti-pattern (same lesson as unmerged #11487 closure-walk branch).
### Approach C: make `findWitnessTableEntry` chase `$inheritance` recursively (closure walk, à la unmerged #11487 patch)
- Ruled out as primary: encodes facet-traversal knowledge in a flat IR helper; masks the malformed shape for ONE consumer while the bad IR persists.

## Recommended path
Approach A. Repro: `build/Debug/bin/slangc tests/.../grandparent-requirement-existential.slang -target cuda ...` Acceptance criteria:
1. Two-level repro compiles for cuda/spirv/hlsl/wgsl and runs correct output (42) on GPU (L40S available).
2. One-level + upcast tests unchanged; add regression test `tests/language-feature/dynamic-dispatch/` dispatching a grandparent requirement through an existential box (no covering test exists today — the gap).
3. Full dynamic-dispatch + interfaces suites pass (slang-test -use-test-server).
Note for fixer: the IR lookup chain for the two-level case in -dump-ir output should show per-edge $inheritance lookups after the fix.
Next: BLOCKED ON OPERATOR GO-AHEAD — per dispatch policy (parent note 2026-11-17), a NEW fixer chain on #14537 gates on the operator; hand off when approved.

## Sources
- Local code subagents (2) at HEAD 2a91af5b7: assert semantics + caller inventory; lowering + specialization trace with -dump-ir crash capture.
- Shared wiki: concepts/slang-language-core-f0909b0-interfaces-witness-conformance.md (stale-conformingWitness family ruled OUT); concepts/slang-compiler-type-flow-and-gate-discipline.md (ExtractExistential family ruled OUT).
- DeepWiki Q&A 2 (compressed-witness normalization contract; upcast one-lookup-per-edge).
- Live repro: Debug abort 4 targets; Release segfault.
