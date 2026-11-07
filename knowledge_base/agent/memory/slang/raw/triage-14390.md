---
type: triage
title: "Triage: shader-slang/slang#14390 — WGSL barrier in a loop bounded by a groupshared value fails Tint uniformity"
description: "Bug, medium, P2, target-emit WGSL. Reproduced on master b85caf928 + Tint (dawn.node webgpu@0.6.2, backend=null). Codegen fix A (promote controlling groupshared loads to workgroupUniformLoad) handed to slang-fixer; diagnostic shape B parked on #14056 (jkwak-work)."
tags: [triage, wgsl, uniformity, barrier, groupshared]
---
# Triage: shader-slang/slang#14390 — WGSL: barrier in a loop bounded by a groupshared value fails uniformity analysis
Date: 2026-11-06 | Bug | medium | P2 normal | target-emit (WGSL) | Duplicate: no

## What's broken
Valid HLSL-style source: one thread writes `groupshared uint gCount`, `GroupMemoryBarrierWithGroupSync()`, then
`for (i < gCount)` with barriers inside. `slangc -target wgsl` exits 0 with no diagnostic; the WGSL reads
`var<workgroup> gCount_0` directly in the loop condition, and Tint/Dawn reject it:
`'workgroupBarrier' must only be called from uniform control flow` / `reading from workgroup storage variable
'gCount_0' may result in a non-uniform value`. WGSL §15.2: any load of a non-read-only module-scope var is
MayBeNonUniform; only `workgroupUniformLoad(p)` returns a uniform value (spec 17.11.4: it executes a control barrier).

## Repro (FACT, master b85caf928, Release slangc rebuilt 2026-11-06 22:39Z)
Scratch: /workspace/agent/scratch-14390/ (repro.slang, v_*.slang, tot_*.wgsl, before-legalize.dump).
`slangc repro.slang -target wgsl -entry main -stage compute -o repro.wgsl` → exit 0.
Validator: `node /workspace/agent/scratch-8774/tools/val.mjs <file.wgsl>` (dawn.node `webgpu@0.6.2`, backend=null = real Tint).
| Variant | Tint |
|---|---|
| repro (loop bound `gCount`) | FAIL (33:9 workgroupBarrier; 23:19 read of gCount_0) |
| `uint n = gCount;` then `i < n` (plain copy to local) | FAIL (taint flows through locals) |
| `uint n = workgroupUniformLoad(gCount);` hoisted before loop | PASS |
| `i < workgroupUniformLoad(gCount)` in the loop condition | PASS |
| bound read directly from `RWStructuredBuffer` (`var<storage, read_write>`) | FAIL (no WGSL uniform-load for storage) |
| bound read from `StructuredBuffer` (`var<storage, read>`) | PASS |
| repro with `-validate-uniformity` | slangc silent, Tint FAIL |
Note: Slang's `workgroupUniformLoad(x)` works directly with no `__target_switch` (on non-WGSL it is a plain load today, #13631).

## Codebase digest (FACT unless marked)
- `workgroupUniformLoad<T>(__ref T v)` hlsl.meta.slang:35832 (wgsl: `__intrinsic_asm "workgroupUniformLoad(&($0))"` :35837,
  default `return v` :35839); Atomic overload :35848.
- Barriers: ordinary core-module funcs, no marker attribute. `GroupMemoryBarrierWithGroupSync` hlsl.meta.slang:12752
  (wgsl `workgroupBarrier` :12765); others :8545, :8565, :10706, :10726, :12727. IR before legalizeIRForWGSL:
  `func %GroupMemoryBarrierWithGroupSync { GenericAsm("workgroupBarrier") }`, user code does `call %GroupMemoryBarrierWithGroupSync()`.
- IR shape of the repro loop (before-legalize.dump:92-101): `loop(%37, %38(break), %39, …)`; header `%40 = load(%gCount)`,
  `ifElse(%41, %42, %38, %42)` — exit branch goes to the break block.
- WGSL pipeline: slang-emit.cpp:2520-2526 (`legalizeBoolSwitch…`, then `legalizeIRForWGSL` slang-ir-wgsl-legalize.cpp:243).
  That pass has no uniformity/barrier logic; its only groupshared rule keeps groupshared globals un-bridged for `ref`
  params (:14-27, :71-81), which is what lets `workgroupUniformLoad` take `&gCount`.
- `var<workgroup>` from `GroupSharedRate` (slang-emit-wgsl.cpp:899-901; addr space slang-ir-wgsl-legalize.cpp:330).
- slang-ir-uniformity.cpp (opt-in `-validate-uniformity`, slang-emit.cpp:1582-1584): no barrier/groupshared/load handling.
- IR dominators: forward tree only, no post-dominator tree (slang-ir-dominators.h:163 TODO). Slang IR is structured
  (ifElse merge block, loop break/continue blocks), which gives exact control-dependent regions without post-dominance.
- Tests: tests/wgsl/workgroup-uniform-load.slang, -atomic.slang, wave-lane-count-uniform-loop-bound.slang (#8774). None covers
  a barrier under a groupshared-controlled branch. Docs: docs/user-guide/a2-03-wgsl-target-specific.md has no uniformity text.
- DeepWiki (2 Qs): confirms no pass inserts workgroupUniformLoad; no IR decoration marks "requires uniform control flow".

## Candidate approaches
### A: WGSL codegen — promote controlling groupshared loads to workgroupUniformLoad  [does NOT depend on #14056]
- Where: new step in `legalizeIRForWGSL` (slang-ir-wgsl-legalize.cpp:243) or a dedicated WGSL pass called from slang-emit.cpp:2524.
- Mechanism: (1) identify barrier call sites — preferably a marker decoration on the core-module group barriers (+ workgroupUniformLoad),
  with a transitive "contains barrier" summary for user callees; (2) for each structured ifElse/switch/loop-exit condition whose
  controlled region contains a barrier (for a loop exit: the whole loop body), walk the condition's SSA operands (pure ops, block
  params) to a `load` whose root address is a GroupShared global; (3) replace that load with the WGSL workgroupUniformLoad call.
  Optional perf: hoist a promoted loop-header load to the preheader when the loop body stores nothing to that variable.
- Behaviour delta: reporter's kernel emits Tint-valid WGSL; other targets unchanged.
- Tradeoffs: inserts a control barrier per promoted load (Tint lowers workgroupUniformLoad as barrier;load;barrier). Safe for any
  well-defined source: the barrier it controls must be reached uniformly, so the read is reached uniformly too. Cannot fix
  read_write storage reads (no WGSL equivalent). Needs exact region computation incl. break/continue/return out of the region.
- Risk: medium — over-promotion of a load that sits in thread-dependent control flow would make a Tint-valid module invalid.
### B: compile-time diagnostic at the read  [DEPENDS on #14056 — decision owner jkwak-work]
- Where: slang-ir-uniformity.cpp (opt-in) or a WGSL-target check; same barrier-marker + control-dependence core as A and #14056.
- Delta: warning/error pointing at the groupshared (or RW storage) read, suggesting workgroupUniformLoad. Covers the RW-storage case A cannot.
- Tradeoff/risk: whether it is opt-in (`-validate-uniformity`) or default is exactly #14056's open question
  (cmt 6589464727); do not pre-empt it. Precision must match Tint or it is a false-positive regression.
### C: docs-only  [does NOT depend on #14056]
- Where: docs/user-guide/a2-03-wgsl-target-specific.md. Document the rule and that `workgroupUniformLoad(x)` works without
  `__target_switch`. Lowest risk; does not meet the reporter's "expected".
### Ruled out: WGSL `@diagnostic(off, …)` (#13640/#13660) — barrier uniformity is not a filterable triggering rule (WGSL §2.3.2).

## Recommended path (solution brief for slang-fixer)
- Hypothesis: the WGSL backend has no notion of barriers/uniformity, so a plain groupshared load controlling a barrier region is
  emitted as a non-uniform read (FACT: no rewrite exists; Tint FAIL; hand-written workgroupUniformLoad PASS).
- Recommended: Approach A, scoped to GroupShared loads (WGSL/WGSL-SPIRV targets only), plus C's doc paragraph in the same PR.
  Leave diagnostics (B) and RW-storage reads out — they wait for jkwak-work's #14056 decision.
- Files: slang-ir-wgsl-legalize.cpp:243 (or new pass), slang-emit.cpp:2520-2526, hlsl.meta.slang:12752 (+ other barriers) for a marker.
- Repro: `build/Release/bin/slangc /workspace/agent/scratch-14390/repro.slang -target wgsl -entry main -stage compute -o r.wgsl && node /workspace/agent/scratch-8774/tools/val.mjs r.wgsl`
- Accept when: (1) repro + the `uint n = gCount;` variant pass Tint; (2) negative tests — groupshared read under a
  `tid`-dependent branch with the barrier outside, and a groupshared-bounded loop with no barrier — get NO workgroupUniformLoad
  (FileCheck CHECK-NOT) and still pass Tint; (3) a helper-function barrier inside the loop is promoted too; (4) non-WGSL output
  byte-identical; (5) tests/wgsl/ passes. GPU functional check via dawn.node `DAWN_OPTS=backend=vulkan` on the L40S if feasible.
- Open question to surface in the PR (not blocking a draft): is the WGSL backend allowed to add workgroupUniformLoad's barrier implicitly?

## Sources
- Related, not duplicates: #14056 (barrier-uniformity diagnostic, parked on jkwak-work; Rec A opt-in vs default), #13631 /
  draft PR #13659 (workgroupUniformLoad semantics on non-WGSL), #8774 / PR #13897 / #13667 / merged #13883 (var<private> builtin
  copies), #13640 / PR #13660 (WGSL diagnostic directives), #13977 (uniformity pass param fix), #13919 merged (Atomic overload),
  #6962 (derivative uniformity in WGSL loops). Cross-ref timeline of #14390: empty (2026-11-06 22:4xZ).
- Domain: `domain/barrier-uniformity-validation.md`, `domain/wgsl-subgroup-uniformity-rules.md` (in the slang-triager's own memory store, not this one; de-linked 2026-11-07 so they no longer dangle here).
