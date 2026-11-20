---
type: triage
title: "Triage #14494 — CUDA short-circuit || chains → bool temps → nvcc select chains"
description: "Verified on master sm_89; root = frontend short-circuit diamond + no pre-emit reconstruction; Rec A = IR pass diamond→kIROp_Or."
tags: [cuda, short-circuit, codegen-quality, ir]
---

# Triage: shader-slang/slang#14494 — CUDA: short-circuit || chains emitted as bool temporaries (nvcc → selp.u16 select chains)

Date: 2026-11-16 | Category: bug (codegen pessimization) | Severity: medium | Priority: P2 | Component: IR → target-emit (CUDA/C++ source) | Duplicate: no

## What's broken
On `-target cuda`, `if (a || b || ...) continue;` compiles to a chain of `bool` temporaries
(one if/else per operand) in the emitted .cu. nvcc must materialize those bools (16-bit in
NVVM) → `selp.u16` + `setp.ne.s16` (PTX), `SEL` + `PRMT 0x9910` + `ISETP` (SASS), with later
loads predicated — instead of the compare-and-branch that hand-written CUDA (or one
`if (x) continue;` per test) gets. Measured by reporter: +11.7% warp instructions, ~+5%
kernel time (RTX 4060 Ti). Correctness is unaffected; pure codegen quality.

## Repro — VERIFIED on master 2026.13.1-50-g3649fb982 (L40S sm_89, nvcc 12.6)
Reporter's exact kernel (`scratch/14494-repro/grid_query.slang`):
```
slangc grid_query.slang -target cuda -entry gridQuery -stage compute -O2 -o or.cu
slangc ... -DSPLIT -o split.cu
nvcc -cubin -arch=sm_89 --use_fast_math -I<slang>/include or.cu -o or.cubin
cuobjdump -sass or.cubin
```
- or.cu: 5 `bool _S*` temps (e.g. `if((_S16.x)>(_S5.x)){_S17=true;}else{...}`), matches issue text.
- SASS counts MATCH the reporter's table exactly: or → SEL 15 / PRMT 16 / BRA 13;
  split → SEL 0 / PRMT 0 / BRA 48. ⇒ `reproduced` is earned (label parked: gateway 401 outage).

## Codebase digest (file:line, verified 2026-11-16)
- Scalar `&&`/`||` are short-circuit ONLY for scalar-bool operands: `convertToLogicOperatorExpr`
  (slang-check-expr.cpp:5237–5293) creates `LogicOperatorShortCircuitExpr` (:5276–5283).
- Lowering builds an if-else diamond: `visitLogicOperatorShortCircuitExpr`
  (slang-lower-to-ir.cpp:6691–6754). `||`: true arm = const `true` (:6721–6723), false arm
  evaluates operand 2 (:6739–6741), merge block param = result (:6751). Branch-coverage markers
  sit in BOTH arms (:6715, :6733 — from #13279; only under coverage profiles).
- `eliminatePhis` (slang-emit.cpp:2875) turns the merge param into an `IRVar` bool temp before
  emit; fold gate `getFoldPolicy` marks `kIROp_Param` FoldPolicy::Never (slang-emit-c-like.cpp:1517)
  and `shouldFoldInstIntoUseSites` (:1737) requires single-use + side-effect-free — the temp
  can never fold back into the `if` condition.
- Inline `||` text exists only for `kIROp_And/Or` (slang-emit-c-like.cpp:2730, slang-emit-precedence.h:81) —
  i.e. only NON-short-circuit forms (vector operands, `-disable-short-circuit`, static-const contexts).
- NO pass anywhere reconstructs diamond → logical op (`trySimplifyIfElse` slang-ir-simplify-cfg.cpp:512–565
  only deletes empty arms; `legalizeLogicalAndOr` slang-ir-legalize-binary-operator.cpp:224–354 only
  fixes types of existing And/Or).
- `-disable-short-circuit` (slang-options.cpp:783–786 → slang-check-impl.h:1480–1484) proves the
  kIROp_Or plumbing works end-to-end, but it changes user semantics — NOT a fix.
- Safety precedent for inline `||`: GLSL `_tryEmitLogicalBinOp` (slang-emit-glsl.cpp:2114–2139,
  rationale comment :2119 — folding never inlines side-effectful subexprs); C/C++ `||` short-circuits
  natively, so re-emitting `a || b` preserves the diamond's semantics exactly when operands are pure.
- All source targets (GLSL/HLSL/Metal/WGSL) receive the same diamond (lowering is target-independent);
  only their kIROp_And/Or handlers (non-short-circuit forms) differ.

## Candidate approaches
### A: Pre-emit IR pass — reconstruct the canonical diamond into kIROp_And/Or (RECOMMENDED)
- Where: new pass (e.g. extend `simplifyForEmit` slang-ir-simplify-for-emit.cpp or a dedicated
  slang-ir-reconstruct-short-circuit.cpp) hooked in slang-emit.cpp BEFORE `eliminatePhis` (:2875).
- Pattern: exact canonical shape from slang-lower-to-ir.cpp:6703–6751 — `ifElse(cond, then, else, after)`
  where one arm ends in `branch(after, const bool)` and the other in `branch(after, <operand2>)`,
  after-block has exactly 1 param with exactly 2 predecessor args; iterate backward through nested
  diamonds to recover whole chains.
- Gates: merge param single-use; operand2 side-effect-free & foldable (reuse the logic shape of
  `shouldFoldInstIntoUseSites`, but in IR terms); bail on branch-coverage markers present in arms.
- Behaviour delta: .cu gets `if ((a) || (b) || (c)) continue;` — nvcc lowers to compare-and-branch.
- Tradeoffs: small blast radius if run only for C-family source targets (or all source targets — GLSL/HLSL
  `||` also short-circuit; WGSL `||` does NOT — gate needed, or restrict to CPP/CUDA emitters first).
- Risk: pattern-match must be exact to avoid miscompiles; debug scopes in arms must be handled.
### B: Keep short-circuit as a first-class IR op end-to-end
- Where: new IRLogicalAnd/Or short-circuit op from visitLogicOperatorShortCircuitExpr; each backend lowers it.
- Tradeoffs: touches every backend + IR opcode tables + autodiff + coverage — large blast radius/cost.
- Ruled out for this fix by cost; long-term-cleanest if more backends need the distinction.
### C: Emitter-side reconstitution (post-eliminatePhis)
- Where: extend fold gates in slang-emit-c-like.cpp to re-emit the bool-temp diamond inline.
- Ruled out: post-`eliminatePhis` shape is muddied IRVar stores/loads; region-based emit is the wrong layer.

## Recommended path
**A.** Fastest correct fix; reuses proven end-to-end plumbing (kIROp_Or → `||` text already exists);
gates (pure operands, single use, no coverage markers) make it safe. Start gated to CUDA/CPP
source emitters; widening to GLSL/HLSL is a follow-up decision for the maintainers.

## Sources
- Local source: all file:line above read at 2026-11-16 master g3649fb982.
- DeepWiki: confirms scalar && / || → ifElse diamond w/ bool merge param; no known reconstruction pass.
- Dup search (HTML, 43 "short-circuit" hits): none match; nearest context #13278/#13279 (branch coverage
  for ?:, &&, || — the marker source), #11403 (slangi VM ?:), #14016 (same reporter, different topic).
- Reporter (albertrodriguezclo, also #14390): issue data 100% consistent with our independent SASS counts.
