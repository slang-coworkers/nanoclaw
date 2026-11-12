---
type: triage
title: "Triage: shader-slang/slang#14350 — Canonical IR set order depends on the C++ compiler that built slangc"
description: getSet sorts by lazily-assigned getUniqueID inside the std::sort comparator; order = f(operand eval order, STL sort pattern). Dup of #13474. Rec A = pre-assign IDs in iteration order.
tags: [ir, typeflow, determinism, dynamic-dispatch, duplicate]
---

# Triage: shader-slang/slang#14350 — Canonical IR set order depends on the C++ compiler that built slangc
Date: 2026-11-11 | bug | low | P2 | IR (type-flow specialization / `IRBuilder::getSet`)
Reporter + assignee: jhelferty-nv (MEMBER), Type=Bug (set by her). Scope from orchestrator: triage only, no fixer.
**Duplicate of #13474** (bot-filed 10-07 during #12875/#12609; assigned to jvepsalainen-nv by jhelferty-nv 10-07 17:51Z; 0 comments).
#14350 adds over #13474: a self-contained HLSL repro, the std::sort comparison-pattern dependence (not just operand order), a fix proposal, a 2nd test hit (#11709 dynamic-dispatch.slang → CHECK-DAG).

## What's broken
`IRBuilder::getSet` (source/slang/slang-ir.cpp:7597-7599) sorts with `getUniqueID(a) < getUniqueID(b)`;
`getUniqueID` (:7667) hands out `count+1` on first call. When elements have no ID yet, the comparator call
sequence assigns them → order depends on (1) operand evaluation order of `<` (unspecified in C++), (2) which pairs
`std::sort` (List::sort → std::sort, source/core/slang-list.h:527) compares, which differs across libstdc++/libc++/MSVC STL.
The IDs are not just ordering: they ARE the dispatch tags (lower-dynamic-dispatch-insts.cpp:592, :917-985), so
emitted integer constants differ too. Output is correct either way; not reproducible across host builds.

## Repro (master c66100b1e, GCC 12.2 — Linux CI's compiler; Clang 14 here can't build master)
Issue's repro, `slangc -target hlsl -stage compute -entry computeMain -conformance "Add:IFill=0" -conformance "Mul:IFill=1"`.
Scratch worktree /workspace/agent/wt-14350 with env-var-switched instrumentation (SLANG_14350_MODE; never pushed).
| mode | meaning | 2-conformer result | 5-conformer (Add,Mul,Sub,Xor,Shl) tags |
|---|---|---|---|
| 0 | master | Add=1 first, Mul=2 | Xor=1 Shl=2 Sub=3 Mul=4 Add=5 |
| 8 | explicit a-then-b | = mode 0 (GCC evaluates left first) | — |
| 1 | getSet comparator b-then-a (MSVC stand-in) | **Mul=1 first**, Add=2 (= issue's MSVC result) | Shl=1 Xor=2 Sub=3 Mul=4 Add=5 |
| 2 | typeflow merge comparator (typeflow:1226) b-then-a | = mode 0 (merge not decisive here) | — |
| 32 | std::stable_sort, same operand order | = mode 0 | Xor=1 Shl=2 Sub=3 **Add=4 Mul=5** (sort pattern alone changes order) |
| 4 | pre-assign IDs in HashSet iteration order (fix A) | Mul=1 first | Shl=1 Xor=2 Sub=3 Mul=4 Add=5 |
| 5,6,7,12,28,36,37 | fix A + any comparator order / stable_sort | byte-identical to mode 4 (md5 898d41ab / e7282271) | identical |

## Codebase digest
- slang-ir.cpp:7586 `getSet(op, const HashSet<IRInst*>&)` → list → sort → emitIntrinsicInst (hash-consed).
- slang-ir.cpp:7609 `getSetFromSortedElements` — only caller typeflow:1242 (linear merge). Comment :7631-7634 says
  "Elements of an already-built set always have IDs" — **false for singletons**: `getSingletonSet` (:7662) → getSet with 1
  element → std::sort never calls the comparator → no ID. ~16 singleton call sites in typeflow (753, 2327, 2519, …).
- typeflow-specialize.cpp:1226 merge `getUniqueID(a) < getUniqueID(b)`: CAN assign IDs when merging two singletons whose
  elements lack IDs → same eval-order hazard. The issue says this site is unaffected today; that is only true when inputs have IDs.
- Tags = unique IDs: GetTagOfElementInSet → int literal (lower-dynamic-dispatch-insts.cpp:592); seq-ID↔tag map :917-985;
  `createDispatchFunc` (:274) iterates a Dictionary filled in set-operand order by `getDispatcher` (typeflow:6680-6773).
- HashSet = ankerl::unordered_dense map → iteration = insertion order (erase = swap-with-last), pointer/hash independent.
  So iteration order is deterministic given deterministic IR. For collectExistentialTables (typeflow:8376) it is the
  WitnessTableType's use-list order → reverse declaration order in the repros (Shl..Add, Mul before Add).
- ID map `IRModule::m_mapInstToUniqueId` (slang-ir.h:2314): per-module, never cleared, monotonic.
- CI compilers: Linux=gcc, macOS=clang, Windows=cl (.github/workflows/ci.yml). On the 2-conformer repro GCC (measured) and Clang (per the issue) agree: Add first.

## Test-suite churn (full slang-test, GCC Release build-gcc, -use-test-server -server-count 24, L40S)
- mode 0 (master), mode 4 (fix A), mode 1 (MSVC stand-in): each 11880/11884 passed, 3290 ignored; failure sets IDENTICAL:
  fp8-cuda-e5m2 / fp8-cuda-half-acc / fp8-cuda (cuda; also fail on master per 14063 notes) + cpu-program/gfx-smoke (GFX off).
- ⇒ no current test depends on set order (the #12875/#11709 workarounds made them order-insensitive); fix A has zero churn on Linux.
  Logs: /tmp/st-14350-m{0,1,4}.log (ephemeral).

## Candidate approaches
### A: Pre-assign IDs in iteration order before sorting (issue's proposal) — RECOMMENDED
- Where: slang-ir.cpp:7593-7599 (loop `getUniqueID(e)` over elements before sort; optionally sort (id,inst) pairs).
- Delta: order = ID order where fresh elements get IDs in HashSet iteration order. Independent of operand order and STL
  sort pattern (unique keys → any correct sort gives one result). Singletons now get IDs at creation, which also closes the
  typeflow:1226 merge hazard and makes the :7631 comment true.
- Tradeoffs: +1 hash lookup per element (or fewer with pairs). Re-baselines Linux/macOS output to the current MSVC order
  for 2-element fresh sets (verified on repro); larger sets get a new order on every platform.
- Risk: low; measured zero test churn (above). A new ordered-CHECK test is needed to lock the behaviour in.
### B: Sequence the two calls inside the comparator(s)
- Where: slang-ir.cpp:7599 and typeflow:1226.
- Delta: removes compiler eval-order dependence only. Still depends on the STL's comparison pattern (mode 32 proves the
  sort pattern alone moves Add/Mul). libstdc++ (Linux) vs libc++ (macOS) vs MSVC STL differ → insufficient. Rejected.
### C: Assign IDs at a deterministic program point (e.g. module order at typeflow start)
- Where: start of typeflow specialization / `collectExistentialTables`.
- Delta: canonical order ≈ declaration order (more human-predictable). Still needs A as backstop for insts created mid-pass
  (e.g. emitSpecializeInst results at typeflow:4220). Larger blast radius (more IDs, all tags change). Optional follow-up.

## Recommended path
A in `IRBuilder::getSet` (slang-ir.cpp:7593-7599): assign IDs to every element in iteration order before the sort (sort
(id, inst) pairs or keep the comparator as a pure lookup). Update the :7631-7634 comment; the `_DEBUG` check in
`getSetFromSortedElements` can then assert IDs exist. Leave typeflow:1226 alone (its inputs then always have IDs) or
sequence it for robustness. Tests: restore ordered CHECKs in tests/language-feature/groupshared-param/dynamic-dispatch.slang
(drop CHECK-DAG) and add a ≥3-conformer ordered-CHECK test, so CI on Linux/macOS/Windows enforces the same order.
Acceptance: same emitted HLSL on all three CI platforms for both repros; output invariant under swapped comparator
operand order and under std::stable_sort (scratch check); full slang-test no new failures.
Open question for the assignee: is iteration (use-list ≈ reverse-declaration) order acceptable as the canonical order, or
is declaration order wanted (→ C)?

## Sources
- DeepWiki: set canonicalization + tags = unique IDs (confirms); per-module ID map not serialized/never shared.
- #13474 (dup), #12875 (first hit, per-conformer FileCheck workaround), #11709 (second hit, CHECK-DAG), #12616 (merge path).
- Shared learning 1791336133684 (set order host-compiler dependent).
