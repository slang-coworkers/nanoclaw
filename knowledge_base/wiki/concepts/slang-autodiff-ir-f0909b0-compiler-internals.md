---
title: Slang autodiff & IR internals — producer layers, SSA/VM invariants, and dev traps
type: concept
group: slang-autodiff-ir
tags: [slang, autodiff, ir, ssa, slangi-vm, validation, codegen, hlsl-atomic, sroa, unit-test, triage]
source_count: 10
---

## TL;DR

When a symptom looks like an autodiff bug, the autodiff *pass* is usually not the
producer — trace the actual op back to its real origin before routing a fixer.

- **HLSL float atomic-add is NVAPI-only and emitted silently.** `RWByteAddressBuffer.InterlockedAddF32`
  lowers only to `NvInterlockedAddFp32` (NVIDIA NVAPI); on AMD-D3D12 it can't perform
  the atomic, so a backward-autodiff gradient scatter never accumulates → grads all-zero.
  `slangc -target hlsl` emits it with rc=0 and empty stderr. The atomic comes from the
  tensor wrapper's hand-written `[BackwardDerivative]`, not from any autodiff source —
  `grep` the autodiff pass for the op returns zero hits.
- **A `[Differentiable]` function's backward is committed at front-end check time**
  (`checkDifferentiableCallableCommon`), not in the IR pass — so rerouting it in
  `maybeTranslateBackwardDerivative` leaves the emitted body byte-unchanged.
- **Arch-dependent wrong autodiff result → suspect the slangi VM, not the transform.**
  The bytecode VM never zero-inits its working-set frame; reused slots keep prior bytes
  (0 on cold aarch64 pages, stale-but-correct on warm x86_64). Reproduce with valgrind/MSan
  on x86_64. A GPU-free `-cpu`/host-callable UB sweep of the same class was a clean MISS.
- **`-validate-ir-detailed` can SIGABRT on transient invalid-SSA** left intentionally by
  autodiff finalization and repaired later; plain `-validate-ir` + normal compile stay green.
  A false-positive class, not a codegen bug.
- **Narrow-SROA machinery is ~90% present** but the value-based enabler
  (`eliminateAddressInsts`) is autodiff-only-gated; `constructSSA` rejects any local whose
  element chain ends in a store.
- **ForceInline `if/else-if` cascades lower to a chain of nested single-param merges**, not
  one common merge; `AFTER-legalizeEmptyTypes` is the last SSA-form state before phi-elim.
- **Two "verify the reviewer nit" corrections:** a `defaultArgSource` count-equality assert
  would fire on valid `bwd_diff` input (the guard is load-bearing), and `SLANG_CHECK_MSG`
  needs a compile-time string literal (use `addResultWithLocation` for dynamic messages).

## Producer-layer discipline: the atomic and the backward both come from the tensor wrapper, not the pass

The D3D arm of a slangpy all-zero-gradient bug (`slangpy#222` → `slang#12505`) is the
canonical "autodiff didn't produce it" case. On HLSL/D3D,
`RWByteAddressBuffer.InterlockedAddF32(float)` (`hlsl.meta.slang:6536`/`:6681`, both carrying
`[__requiresNVAPI]`) lowers **only** to the NVIDIA-only NVAPI intrinsic `NvInterlockedAddFp32`,
emitted silently — `slangc -target hlsl` returns rc=0 with empty stderr and unconditionally
writes `#define SLANG_HLSL_ENABLE_NVAPI 1` + `#include nvHLSLExtns.h`
([HLSL float atomic-add NVAPI-only](../learnings/1786551719062-slang-hlsl-float-atomic-add-is-nvapi-only-and-emit.md),
[tensor producer is not the autodiff pass](../learnings/1786552449501-hlsl-float-atomic-add-is-nvapi-only-and-emits-sile.md)).
On AMD-D3D12 the atomic can't run, the gradient scatter never accumulates, and the grad
comes back `[0,0,0,0]`.

The triage lesson is exact: *"autodiff generates the atomic" is inaccurate at the producer
level.* `grep -riE 'atomicadd|interlocked|kirop_atomic' slang-ir-autodiff*.cpp` is **0 hits**;
autodiff aggregates gradients with a scalar `dadd` (`emitDAddOfDiffInstType`,
`slang-ir-autodiff.cpp:646`). The atomic originates in the core-module tensor backward path:
`DiffTensorView.load`'s `[BackwardDerivative]` → `AtomicAdd.load_backward`
(`diff.meta.slang:855-860`) → `InterlockedAdd`, which autodiff merely differentiates *through*.
A fixer dispatched to the autodiff sources would find nothing. When a reporter says "pass X
generates op Y," grep pass X for op Y before repeating it — the *higher-order* claim (ungated
float atomic-add on an unsupporting D3D target) was true, but the layer attribution was wrong.

Supporting gotchas from the emit path: the *generic* `InterlockedAdd(floatBuf[i],...)` DOES
hard-error `E55204` (`slang-emit-hlsl.cpp:744-746`), so the asymmetry is that the NVAPI
`InterlockedAddF32` path bypasses that diagnostic entirely. The capability alias
`atomic_glsl_hlsl_nvapi_cuda_metal_float1` (`slang-capabilities.capdef:2616`) is satisfiable on
HLSL only via `hlsl_nvapi` — so "HLSL-but-no-NVAPI" is not expressible today, and diagnosing
the absence (Approach A) would first require introducing that distinction. The `default:` arm
on both decls is an unreachable trap (`case hlsl:` wins, and `__atomic_add` float would itself
hit `E55204`), and there is no in-tree pure-DXC float-atomic CAS precedent — the existing
`InterlockedAddF16Emulated` is itself NVAPI. The fix is a maintainer design call, not mechanical.

## Where a `[Differentiable]` backward is actually committed

For a plain `[Differentiable] f`, the backward *shape* is chosen at semantic-check time in
`SemanticsDeclHeaderVisitor::checkDifferentiableCallableCommon` (`slang-check-decl.cpp:15142`):
it synthesizes f's `IBackwardDifferentiable` extension with a fresh
`kIROp_BackwardDiffIntermediateContextType` context struct and
`addSynthesizedFunc(kIROp_BackwardDifferentiatePrimal/BackwardRemat)`. `bwd_diff(f)` then lowers
to `LegacyBackwardDifferentiate(apply, remat, propagate)`, all keyed to f's own concrete context
([backward committed at front-end check time](../learnings/1787333945518-slang-ad-a-differentiable-function-s-backward-is-c.md)).
By the time any IR pass runs, f's context/apply/remat are already materialized in its
witness/extension, so returning a different 5-tuple from `maybeTranslateBackwardDerivative`
(`slang-ir-autodiff-rev.cpp:984`) leaves the emitted body byte-unchanged — a lost build cycle
if you assume the IR pass owns the routing.

Two corollaries the same investigation surfaced. **Custom vs synthesized backward lives in the
callee's associations, not the op:** `BackwardDifferentiate(callee)` always re-synthesizes from
scratch and DROPS a user `[BackwardDerivative]` (a silent gradient miscompile); the custom-aware
source is the callee's associations (`AnnotationKind::BackwardDerivativeApply=4/…/Propagate=9`),
which for a custom derivative bind to `*FromLegacyBwdDiffFunc(callee, userBwd)` ops. Any change
to a `[Differentiable]` function's backward *structure* must therefore happen at the check-decl
synthesis site (after body definition-check) or in a pass before `specializeModule`
(`slang-emit.cpp:1421`) that rewrites both the witness entries and the call-site associations.
And `no_diff(call)` reuses the same call/return IR but adds
`kIROp_TreatCallAsDifferentiableDecoration`, distinct from explicit `differentiable(...)`'s
`kIROp_DifferentiableCallDecoration` — so any "identity wrapper" IR match must exclude a call
carrying either decoration.

## Arch-dependent autodiff wrongness is a VM bug, not a transform bug

`slang#12871`: `fwd_diff` of a user-type `neg()` returned `0/0` on aarch64 but the correct
`-9 -6` on x86_64 via `//TEST:INTERPRET`/slangi. The root cause is in the interpreter, not the
autodiff transform: **the slangi bytecode VM never zero-initializes its working-set frame
memory** ([arch-dependent → suspect the slangi VM](../learnings/1788287604621-arch-dependent-wrong-autodiff-result-suspect-the-s.md)).
`SlangVM::pushFrame` (`slang-vm.h:103-115`) grows `m_workingSetBuffer` via `List::setCount`,
which reserves + sets count but does not zero; `popFrame` only shrinks, so reused slots keep
prior bytes and only argument data is copied into a fresh frame. Locals/results start
indeterminate → reading them is uninitialized-memory UB, which reads as `0` on cold OS
zero-pages (aarch64 CI) and stale-but-correct on warm reused frames (x86_64). The forward-diff
transform and emitted IR are byte-identical across arches, and zero-tangent materialization
correctly calls the type's `dzero` witness via `getDifferentialZeroOfType` — so a
"dzero vs default-init" hypothesis is the wrong tree. The general rule: **when a wrong autodiff
result is arch-dependent, the bug is almost certainly in the VM/interpreter.** The triage lever
is to build+run the repro under MemorySanitizer or valgrind on x86_64, turning an aarch64-only
failure into an x86_64-reproducible one. Fix direction: zero-init the VM frame on push (scope
the memset to newly-grown words), or size registers by stride.

A companion GPU-free sweep (`slang#12891`, suspected pre-existing negative-sign bug on
`-cpu`/host-callable, `fwd_diff(-(x*x))` on a user `IFloat`) came back a **clean MISS** — no UB
attributable to slang on either `-cpu` sub-path, narrowing the issue to a genuinely
arch-dependent aarch64 problem
([#12891 -cpu autodiff-neg UB sweep = MISS](../learnings/1788385079609-slang-12891-cpu-host-callable-autodiff-neg-ub-swee.md)).
The reusable recipe is worth keeping: the emitted downstream-C++ kernel
(`slangc repro.slang -entry <e> -stage compute -target cpp -o gen.cpp`) is self-contained
enough to compile+run behind a ~12-line harness (`#include "gen.cpp"` + a `main()` that builds a
`ComputeVaryingInput` from `prelude/slang-cpp-types.h`), then compile with `-fsanitize=...` or
run under valgrind — far cleaner than fighting slang-test's harness. Environment caveats: clang-14
compiler-rt runtimes are absent (use gcc's `libubsan`/`libasan`; MSan unavailable, but valgrind
memcheck `--track-origins=yes` covers the same uninitialized-read class); valgrind 3.19 can't
read clang-14 DWARF-5 (compile with `-gdwarf-4`); the LLVM-JIT sub-path is instrumented by
`valgrind ./slang-test <test>` (no `-use-test-server`) forced with `-xslang -emit-cpu-via-llvm`;
and a benign glibc `ld.so` RPATH over-read (`Slang::SharedLibrary::loadWithPlatformPath`) is a
known false positive to filter out.

## Transient invalid-SSA is by design — `-validate-ir-detailed` will trip on it

`slangc … -validate-ir-detailed` can abort with SIGABRT/exit134 and
`E40007 IR validation failed: def must come before use in same block`, while plain
`-validate-ir` and normal compilation succeed and emit valid SPIR-V
([-validate-ir-detailed SIGABRT false-positive](../learnings/1788583275994-validate-ir-detailed-can-sigabrt-on-transient-inva.md)).
The mechanism: `-validate-ir-detailed` validates after *every* `wrapPass` via `postPassHooks`
(`slang-pass-wrapper.cpp:74-76`), so it observes mid-pipeline states plain mode's ~40
hand-placed checkpoints never see. The "def before use" check
(`validateIRInstOperand`, `slang-ir-validate.cpp:201-217`) fires only for inst+operand that are
direct children of the same `IRBlock` (pure linked-list precedence). The autodiff pipeline
*intentionally* leaves IR transiently SSA-invalid (`docs/design/autodiff/ir-overview.md`) and
repairs it with a later hoist/sort (`_maybeHoistOperand`, `sortBlocksInFunc`), so a hoistable
inst can sit before its operand at a pass boundary and be normalized before emit — and because
the IR printer inlines/reorders, `-dump-ir-after` can look clean while the raw list the
validator walks is not. **Triage tell:** plain compile + plain `-validate-ir` green but only
`-validate-ir-detailed` crashing ⇒ suspect a transient mid-pipeline false-positive, not a codegen
bug (the failing pass on #12914 was `finalizeAutoDiffPass`). Established fix idiom: wrap the
known-transient step in `disableIRValidationScope()` (the autodiff code already does this at
`slang-ir-autodiff-cfg-norm.cpp:764` and `slang-ir-autodiff-fwd.cpp:2437`), preferring a
producer insert-point fix for a genuine mis-ordering. Independent hardening: an internal
validation failure currently escapes as an uncaught `AbortCompilationException` → SIGABRT rather
than a clean diagnostic.

## SSA-promotion machinery and merge-block shapes

For promoting small non-escaping fixed-size local arrays/aggregates to SSA (narrow SROA — the
"dead local array + literal-index stores survive to emit" pattern, especially CUDA-via-NVRTC),
the machinery is ~90% present
([narrow-SROA machinery / constructSSA gap](../learnings/1787808786104-slang-narrow-sroa-machinery-constructssa-gap-elimi.md)).
The gap is documented in-source: `slang-ir-ssa.cpp:503-511`'s `isPromotableVar` promotes a local
only when every element access-chain terminates in a LOAD (`allUsesLeadToLoads`); the instant any
chain ends in a STORE (a partial write) the whole var is rejected. The value-based enabler
already exists but is autodiff-only — `eliminateAddressInsts`
(`slang-ir-addr-inst-elimination.cpp`) rewrites `store(elementPtr(arr,i),v)` into
load-whole / `emitUpdateElement` / store-whole, after which `constructSSA` can promote; its
sole caller is `slang-ir-autodiff-fwd.cpp:2433` (`prepareFuncForForwardDiff`) and it emits an
autodiff-specific diagnostic, so "just call it globally" is wrong — it must be gated and
decoupled from the autodiff diag path. The functional-update inst it uses, `IRUpdateElement`
(`emitUpdateElement`, `slang-ir.cpp:6027`), is first-class and broadly consumed. A conservative
size-cap precedent is `kMaxArraySizeToUnroll = 32`
(`slang-ir-lower-buffer-element-type.cpp:462`). Recommended shape for such an issue (#12787):
reuse `eliminateAddressInsts` as a general tightly-gated pre-SSA step behind a candidate filter
(fixed-size + non-escaping + all-constant-index + SSA-safe element type + size ≤ ~32) plus
decoupling from autodiff — the profitability gate is a genuine maintainer design decision.

A related structural fact about how value-returning conditionals lower: an N-way source
`if/else-if/else` where each arm produces a value lowers to **N-1 nested `IRIfElse` regions**,
each with its own after/merge block carrying a `param result` phi — a *chain* of single-param
merges, not one common N-predecessor merge
([last-SSA pass / ForceInline cascade merges](../learnings/1787821210997-slang-last-ssa-pass-before-eliminatephis-is-after-.md)).
For an 8-way `[ForceInline]` cascade → 7 `ifElse`, 0 `switch`: each concrete arm branches only to
its immediate enclosing merge, and each after-block forwards the phi'd result outward one hop per
level until the outermost merge runs the tail and stores. When dumping with
`-dump-ir -target spirv-asm -O3` + `extras/split-ir-dump.py`, the ordering around phi elimination
is `…-simplifyIR → AFTER-legalizeEmptyTypes → AFTER-eliminatePhis` — so `AFTER-legalizeEmptyTypes`
is the last SSA-form (block-param/phi) state before `eliminatePhis` converts block params into
`var`/`load`s. This is the shape any jump-threading / merge-coalescing pass must target.

## Two "verify the reviewer nit before applying it" corrections

Both of these are concrete counterexamples to over-applying the codebase's "assert the invariant
/ fail loudly" and "reuse the existing macro" rules — the reviewer nit was subtly wrong for the
autodiff or dynamic-message case.

A clarity reviewer recommended that when `defaultArgSource` is set,
`SLANG_ASSERT` its param count equals the callee's (treating the `argIndex < getCount()` guard as
silently tolerating a mismatch). The fixer reports the assert is **over-strict**: an autodiff
`bwd_diff` case produces a legitimate call where `defaultArgSource`'s param count differs from the
callee's, so a strict count-equality assert would fire on valid input — the `argIndex < getCount()`
guard is load-bearing for the differentiable-function path
([defaultArgSource count-equality assert is over-strict](../learnings/1787569981440-correction-defaultargsource-count-equality-assert-.md)).
Before recommending "assert this invariant," check the `fwd_diff`/`bwd_diff` paths: they synthesize
callees whose parameter lists are transformed (extra `DifferentialPair` params, dropped/added
params) and will not satisfy a naive positional count-equality. The right nit is often to
*document* why the guard tolerates the mismatch, not to tighten it.

Separately, `SLANG_CHECK_MSG(condition, message)` expands to
`addResultWithLocation((condition), #condition " " message, …)` — the `#condition " " message`
relies on adjacent string-literal concatenation, so `message` MUST be a compile-time literal.
Passing a runtime `const char*` (e.g. `(StringBuilder()<<"value "<<i).getBuffer()`) fails to
compile (`expression cannot be used as a function`)
([SLANG_CHECK_MSG needs a string literal](../learnings/1788161608321-slang-check-msg-requires-a-string-literal-message-.md)).
For a dynamic message, call the reporter directly:
`getTestReporter()->addResultWithLocation(cond, sb.getBuffer(), __FILE__, __LINE__)` — an overload
taking a runtime `const char*` that records a single result (also satisfying the "don't emit two
failure messages" nit). The meta-lesson pairs with the assert case: verify a macro's constraints
before applying a reviewer's "reuse it" suggestion, and always rebuild — a local debug build
caught this before CI.

**Source learnings (10):**

- [HLSL float atomic-add is NVAPI-only and emitted silently; autodiff is not the producer](../learnings/1786551719062-slang-hlsl-float-atomic-add-is-nvapi-only-and-emit.md) — `InterlockedAddF32`→`NvInterlockedAddFp32` silent emit; grep autodiff for the atomic = 0 hits; the higher-order claim was true but the layer attribution wasn't.
- [HLSL float atomic-add NVAPI-only; the tensor producer is not the autodiff pass](../learnings/1786552449501-hlsl-float-atomic-add-is-nvapi-only-and-emits-sile.md) — Sibling with the tensor `[BackwardDerivative]` → `AtomicAdd.load_backward` producer trace, the generic-vs-NVAPI diagnostic asymmetry, the unreachable `default:` arm, and the no-CAS-precedent constraint.
- [A `[Differentiable]` function's backward is committed at front-end check time, not in the IR pass](../learnings/1787333945518-slang-ad-a-differentiable-function-s-backward-is-c.md) — Backward shape synthesized in `checkDifferentiableCallableCommon`; custom vs synthesized lives in callee associations; `no_diff` vs `differentiable(...)` decorations.
- [Arch-dependent wrong autodiff result → suspect the slangi VM (uninitialized working-set)](../learnings/1788287604621-arch-dependent-wrong-autodiff-result-suspect-the-s.md) — VM `pushFrame` never zeros reused frame slots → arch-dependent UB; reproduce with valgrind/MSan on x86_64; not a dzero/default-init issue.
- [slang #12891 -cpu/host-callable autodiff-neg UB sweep = MISS](../learnings/1788385079609-slang-12891-cpu-host-callable-autodiff-neg-ub-swee.md) — Clean MISS narrows to arch-dependent; reusable GPU-free downstream-C++ + sanitizer/valgrind recipe and its environment caveats.
- [-validate-ir-detailed can SIGABRT on transient invalid-SSA from autodiff finalization](../learnings/1788583275994-validate-ir-detailed-can-sigabrt-on-transient-inva.md) — Detailed mode validates after every pass and observes intentional transient invalid-SSA; false-positive class; wrap in `disableIRValidationScope()`.
- [Narrow-SROA machinery: constructSSA gap, eliminateAddressInsts is autodiff-only, IRUpdateElement, 32-elem precedent](../learnings/1787808786104-slang-narrow-sroa-machinery-constructssa-gap-elimi.md) — 90%-present machinery; store-tipped chains rejected; the enabler is autodiff-gated and must be decoupled + candidate-filtered.
- [Last-SSA pass before eliminatePhis is AFTER-legalizeEmptyTypes; ForceInline cascades lower to chained nested merges](../learnings/1787821210997-slang-last-ssa-pass-before-eliminatephis-is-after-.md) — N-way if/else-if → N-1 nested `IRIfElse` with per-level result-phi chain; pass ordering for phi-elim debugging.
- [Correction: defaultArgSource count-equality assert is over-strict (autodiff bwd_diff)](../learnings/1787569981440-correction-defaultargsource-count-equality-assert-.md) — A `bwd_diff` callee's param list legitimately mismatches; the tolerant guard is load-bearing; document, don't assert.
- [SLANG_CHECK_MSG requires a string-literal message — use addResultWithLocation for a dynamic one](../learnings/1788161608321-slang-check-msg-requires-a-string-literal-message-.md) — Adjacent-literal concatenation forces a compile-time literal; call the reporter overload directly for interpolated messages; verify the macro before reusing it.
