---
type: triage
title: "Triage: shader-slang/slang#14646 — SPIR-V crash: runtime texture select + uninitialized resource param"
---

# Triage: shader-slang/slang#14646 — Crash compiling to SPIR-V when a function uses a texture chosen at run time
Date: 2026-11-19 | bug | severity: high | priority: P2 (P1 if bisect confirms regression) | component: IR

## What's broken
`slangc` segfaults (access violation, no diagnostic; only warning E41016 first) compiling to
`-target spirv-asm` at all opt levels when ALL of: (a) a function takes an *uninitialized*
`Texture2D` param (`Texture2D undef; f(undef);` → `LoadFromUninitializedMemory`), (b) the callee
does a *runtime select* between two texture globals (resource-selection sinking), and (c) a value
defined in the select's merge block is used in a *later, separate* block (`uint w = gMode*3;`
consumed inside `if (gMode > 4)`). Each ingredient alone compiles fine (verified: no-param,
no-select, no-w, no-inner-if variants all exit 0).

## Repro (verified on master 2aeded1fd, Release + Debug builds, 2026-11-19)
`slangc repro.hlsl -target spirv-asm` → warning E41016, then SIGSEGV (exit 139).
Repro file saved at /workspace/agent/scratch/14646/repro.hlsl (verbatim from the issue).
Minimal deltas that fix it: drop the `undef` arg, the inner `if`, or the `w` computation.

## Root cause (high confidence; deep analysis in triage-14646-clone-forward-ref-research.md)
Use-after-free via clone-env miss:
1. Producer: select-sinking (`emitIfElseWithBlocks` slang-ir.cpp:6554-6575; used by
   legalizeCompositeSelect slang-ir-legalize-composite-select.cpp:24 and emitConsumer
   slang-ir-specialize-resource-selections.cpp:1458-1466) appends the merge block at END of the
   block list → block-list order ≠ dominance order (use block precedes def block).
   Invariant text: slang-ir.cpp:1558-1561 (`mergeCandidateParentsForHoistableInst`).
2. Consumer: `eliminateUndefinedOpaqueHandles` (slang-ir-eliminate-undefined-opaque-handles.cpp:356)
   specializes `f(undef)` via `specializeFunctionCalls`; `cloneInstDecorationsAndChildren`
   (slang-ir-specialize-function-call.cpp:1141 → slang-ir-clone.cpp:285-333) clones blocks in one
   pass in list order, deferring forward refs ONLY for param types (311-317). Cloning the use
   block misses the (later) def in the env; `findCloneForOperand` (slang-ir-clone.cpp:23-49) falls
   back to the ORIGINAL inst (documented "right default … for globals/constants" — wrong for
   function-local insts).
3. Free: `specializeCall` slang-ir-specialize-function-call.cpp:419-424 deallocates the now-unused
   original f → clone's operand dangles → segfault in SPIR-V emit (`slang-emit-spirv.cpp`; the
   dangling `MakeVectorFromScalar(%47)` operand is visible in `-dump-ir` after
   `eliminateUndefinedOpaqueHandles`; per-pass dumps localize the corruption to exactly that pass).
Precedent: #9718 (same pass family, same clone-time sharing assumption). DeepWiki corroborates:
cloner requires define-before-use in list order for ordinary operands; inliner deliberately
inserts its afterBlock adjacent to the split block for exactly this reason.

## Candidate approaches
### A: Cloner hardening (root-cause layer for the whole class)
- Where: slang-ir-clone.cpp:23-49 `findCloneForOperand` (+ call sites).
- Delta: allow the oldOperand fallback only for module-scoped insts (global/constant); for
  function-local unmapped operands, SLANG_ASSERT (loud) or force a deferred/second-pass clone.
- Tradeoffs: touches shared clone infra (all passes) → wider blast radius, but the fallback's own
  comment names globals/constants as its intended domain, so enforcing it is principled.
- Risk: medium — must confirm no existing pass legitimately relies on the fallback for
  function-local insts (survey callers first).

### B: Producer ordering fix (smallest correct fix for this trigger)
- Where: slang-ir.cpp:6554-6575 `emitIfElseWithBlocks` (insert afterBlock adjacent to the split
  block, not insertAtEnd) and/or slang-ir-specialize-resource-selections.cpp:1458-1466.
- Delta: merge block lands right after the split block → list order dominance-consistent → clone
  visits def before use.
- Tradeoffs: surgical, restores the documented invariant; but leaves the cloner fragile for any
  future producer that appends blocks out of order (the invariant is load-bearing in several
  components).
- Risk: low-medium — verify nothing depends on the appended position.

### C: Two-phase clone (defer ALL ordinary operands)
- Where: slang-ir-clone.cpp:285-333.
- Delta: clone every block first, then fix up ordinary operands (like param types today).
- Tradeoffs: most general; heaviest change to core infra, perf + subtle-behavior risk.
- Risk: high for the payoff; likely overkill if A or B lands.

## Recommended path
B + a thin slice of A: fix the producer ordering (B) as the crash fix, and add the cloner-side
SLANG_ASSERT for non-module-scoped fallback (A) so the next violation fails loudly at the
producer instead of dangling. If the A-survey turns up legit function-local fallback users, ship
B alone and file the A hardening separately. Bisect (optional, before claiming "regression"):
crash needs both select-sinking block order + call specialization; #14358 (resource-selection
rewrite) and #14342 (eliminateUndefinedOpaqueHandles) are recent — confirm whether v2026.21
crashes before labeling `regression`.

## Acceptance criteria
- Repro compiles: `slangc repro.hlsl -target spirv-asm` exits 0; with SLANG_RUN_SPIRV_VALIDATION=1
  the output validates; only E41016 remains (or E41016+E56003 if the fix path makes the unused
  undefined handle reported — either is acceptable; document which).
- New test under tests/spirv/ (or tests/diagnostics/) covering the combination: undefined opaque
  param + runtime select between texture globals + cross-block value use.
- Existing suites pass: tests/spirv/resource-selection-*.slang, tests/diagnostics/ (esp.
  undefined-opaque-handle-*, opaque-local-resource-select).

## Labels applied
reproduced (top-of-tree, this container). Issue Type → Bug. Regression: suspected only (recent
#14342/#14358 in the causal chain; reporter's v2026.22.1 predates #14342's merge — bisect needed
before applying the label).

## Sources
- Local: per-pass -dump-ir bisect (crash between performIntrinsicFunctionInlining and
  eliminateUndefinedOpaqueHandles dumps; dangling operand visible); variant experiments v1-v5.
- Subagent research memo: memory/issues/triage-14646-clone-forward-ref-research.md
- DeepWiki: cloner define-before-use requirement + findCloneForOperand fallback semantics (2 Q&As).
- Prior art: #9718 (clone-time sharing), #14101/#14358 (resource selection), #14342 (undefined
  opaque handles), shared wiki concepts: slang-backends-spirv-emit-and-legalization-defects,
  slang-compiler-ir-phis-and-global-value-placement.
