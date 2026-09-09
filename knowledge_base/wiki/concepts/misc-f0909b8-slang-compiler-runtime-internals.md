---
title: "Slang compiler & runtime internals: codegen, type-system, CUDA, arch bugs, and slang-rhi"
type: concept
group: misc
tags: [slang, codegen, ir, type-system, buffer-load, cuda, nvrtc, andtype, uninitialized-memory, aarch64, slang-rhi, vulkan, root-cause]
source_count: 9
---

## TL;DR

Nine root-cause investigations of Slang compiler codegen/type-system bugs and
slang-rhi runtime hazards, each landing on a *principled producer-side or
representation fix* rather than a downstream band-aid. Recurring lessons:

- **Fix the producer/representation, not the consumer.** An unsupported-but-formable
  type construct that hits a "should have been X'd" assert deserves a front-end
  diagnostic at the producer boundary — not making the assert site "succeed" (which
  only relocates the crash downstream, unless every downstream stage supports the
  shape).
- **Prove equivalence before concluding "form X works, form Y doesn't."** A dropped
  nested-call argument silently changes an optimization; a "free function works"
  experiment must be a *true desugaring* of the failing method.
- **Uninitialized-memory UB shows as architecture-specific wrong answers.** A
  member with no default initializer branched on indeterminate memory → correct on
  x86_64, wrong on aarch64. Valgrind memcheck pinpoints it; `Type type = Type::Unknown;`
  is the robust-by-construction fix.
- **A gate on `F32_*` wrappers is bypassed by `F16_*`/`F64_*` that call libm
  directly** — grep for the sibling-precision wrappers when adding a define-gated
  intrinsic; and `#ifdef` bodies in the CUDA prelude are compiled by NO emit
  filecheck test (only the offline-nvcc CI fixture).
- **slang-rhi diverges from the slang compiler on style** (rejects C++17 if-init
  statements) and has a **pNext self-link hazard**: never add two
  `SIMPLE_EXTENSION_FEATURE` blocks against the same Vulkan feature struct (cyclic
  pNext → driver hang). Static "this pool is leaked" analysis is not proof it is
  live on a given repro path — set a debugger breakpoint on the creation function.

## Type-system: conjunctions and unsupported-but-formable shapes

An `AndType` (interface or scalar conjunction like `A & B`) is flattened only at
generic-constraint and inheritance-clause sites; used as a *value* type it flattens
nowhere and ICEs downstream. The fix is a front-end diagnostic at the value-type
boundary (`CoerceToUsableType`/`CheckUsableType`, distinct from `CheckProperType`),
with additional catches at member lookup — because a conjunction value also arises
from `(A&B)*` deref or `Box<A&B>.field`, which only surface there. Gotchas:
`as<AndType>` is structural (use `getCanonicalType()` to catch a typealias); never
`SLANG_ASSERT(false); return;` for graceful recovery (assume-UB in release); and
`int & float` also forms an AndType so the diagnostic says "conjunction type"
[diagnosing an AndType used as a value type](../learnings/1788305887634-slang-diagnosing-an-andtype-conjunction-used-as-a-.md).
The triage discipline behind this is general: an assert with a "should have been
X'd" message means the invariant is maintained by *upstream producers*; recommend a
front-end diagnostic only after confirming every downstream stage (type layout, IR
lowering, codegen) actually supports the shape — here TypeLayout does *not*
accommodate conjunction existentials, so recursing to make lookup succeed would
just move the crash
[ICE on unsupported-but-formable construct → front-end diagnostic](../learnings/1788316685226-ice-on-unsupported-but-formable-type-construct-rec.md).

## Codegen: buffer-load narrowing and CUDA fp-mode gating

A large-array struct buffer-load copy (16MB SPIR-V function array → NVIDIA pipeline
hang) is NOT method-specific and NOT by-value-vs-by-reference per se: the trigger is
*any use that passes the whole loaded struct value into a live function call*, which
blocks `specializeFuncsForBufferLoadArgs`/`deferBufferLoad` from narrowing to the
accessed leaf. `[constref]` is unsupported and must never be recommended; changing
`this` passing-mode caused 57 regressions; the correct fix axis is the
buffer-load-narrowing machinery. The atom is itself a *correction* of an earlier
mis-scoped learning, and its meta-lesson is to prove two forms are true desugarings
before concluding one works
[large-array buffer-load copy blocks narrowing (correction)](../learnings/1788199334885-correction-large-array-struct-buffer-load-copy-is-.md).
For CUDA `-fp-mode fast`, gating the nine `F32_*` transcendentals leaves `F16_tan`/
`F16_pow` bypassing the gate because they promote to float and call `::tanf`/`::powf`
directly (the only two half wrappers that route through libm) — grep sibling-
precision wrappers when adding a gate; and the `#ifdef`-gated prelude bodies are
compiled by no emit filecheck (emitted as an `#include`), so gating new intrinsics
needs an offline-nvcc compile fixture
[CUDA fp-mode-fast F16 tan/pow bypass + untested #ifdef bodies](../learnings/1788291035439-cuda-fp-mode-fast-gating-f16-tan-pow-bypass-prelud.md).

## NVRTC PCH plumbing and arch-specific UB

Surfacing NVRTC automatic-PCH status to a unit test required a Slang-owned token
appended to the artifact's raw diagnostics (`slang-nvrtc-pch-status:
created|not-created|unavailable`), because `-pch` never changes emitted PTX and the
only signal is `nvrtcGetPCHCreateStatus`; the PCH win depends on the prelude being a
leading `#include` (header-stop-point), the status entry point must be loaded
outside the `SLANG_NVRTC_FUNCS` X-macro (null-tolerantly, since it's pre-12.8), and
`NVRTC_ERROR_NO_PCH_CREATE_ATTEMPTED` does not prove reuse
[surfacing NVRTC PCH create-status to a unit test](../learnings/1788341328356-surfacing-nvrtc-pch-create-status-to-a-slang-unit-.md).
Separately, an aarch64-only wrong answer in a `//TEST:INTERPRET` (slangi/HostVM)
test — even the primal wrong — traced to uninitialized-memory UB in the
module-serialization path: `PathInfo::type` had no default member initializer, so
`hasFoundPath()` branched on indeterminate memory. Valgrind flags the UB on x86_64
even though the wrong *answer* only reproduces on aarch64; the fix is `Type type =
Type::Unknown;`
[aarch64-only wrong answers trace to uninitialized PathInfo::type](../learnings/1788357185401-aarch64-only-wrong-answers-in-slangi-hostvm-tests-.md).

## slang-rhi: task-pool root-cause, style, and pNext hazard

Three slang-rhi atoms. The #12706 teardown heap-corruption was *wrongly* attributed
to the leaked process-global task pool — the reporter set an LLDB breakpoint on
`globalTaskPool()` and it was never hit (the pool is reached only for
`entryPointCount > 1`/OptiX, and the repro has one compute entry point); the ~29
threads were lavapipe's own llvmpipe workers. Lesson: a thread count matching
`hardware_concurrency()` does not identify which pool, and static "this pool is
leaked" analysis is not proof it is live
[slang-rhi global task pool not on the repro path](../learnings/1788199925073-slang-rhi-global-task-pool-is-not-on-single-entry-.md).
On style, slang-rhi rejects the C++17 `if (init; cond)` pattern that the slang
*compiler* CLAUDE.md explicitly recommends — declare the variable on its own line;
this convention divergence must not be carried across repos
[slang-rhi rejects C++17 if-init statements](../learnings/1788361969335-slang-rhi-rejects-c-17-if-init-statements-diverges.md).
And the pNext hazard: `addFeatureExtension` unconditionally self-links its struct
into the device-create pNext chain, so a second `SIMPLE_EXTENSION_FEATURE` block on
the same Vulkan feature struct sets `s.pNext = &s` → cyclic chain → driver hang;
keep one extension block chained once and add per-subfeature `push_back`s inside its
body, guarded on the already-filled sub-bits
[slang-rhi pNext hazard: never chain the same struct twice](../learnings/1788373676487-slang-rhi-pnext-hazard-never-add-multiple-simple-e.md).

**Source learnings (9):**

- [CORRECTION: large-array struct buffer-load copy is a by-value use that blocks narrowing](../learnings/1788199334885-correction-large-array-struct-buffer-load-copy-is-.md) — #12786; retracts the method-specific/`[constref]` framing; trigger is a live whole-value use passed to a call; fix axis is buffer-load narrowing, not `this` passing-mode (57 regressions).
- [CUDA fp-mode-fast gating: F16 tan/pow bypass + prelude #ifdef bodies untested](../learnings/1788291035439-cuda-fp-mode-fast-gating-f16-tan-pow-bypass-prelud.md) — #12872; grep F16_x/F64_x that call libm directly when gating F32_x; #ifdef prelude bodies need an offline-nvcc fixture, not just an emit filecheck.
- [Slang: diagnosing an AndType (conjunction) used as a value type](../learnings/1788305887634-slang-diagnosing-an-andtype-conjunction-used-as-a-.md) — #12873; flatten sites are decl-only; diagnose at CoerceToUsableType + member lookup; use getCanonicalType; never SLANG_ASSERT(false)+return.
- [ICE on unsupported-but-formable type construct → recommend a front-end diagnostic](../learnings/1788316685226-ice-on-unsupported-but-formable-type-construct-rec.md) — #12873; verify every downstream stage supports the shape before recommending "handle it at the assert site" — TypeLayout can't, so diagnose instead.
- [aarch64-only wrong-answers in slangi/HostVM tests trace to uninitialized PathInfo::type](../learnings/1788357185401-aarch64-only-wrong-answers-in-slangi-hostvm-tests-.md) — #12879; uninit-memory UB shows as arch-specific wrong answers; Valgrind flags it on x86_64; file the tracking issue immediately when descoping.
- [Surfacing NVRTC PCH create-status to a Slang unit test](../learnings/1788341328356-surfacing-nvrtc-pch-create-status-to-a-slang-unit-.md) — #12622; -pch never changes PTX so surface a Slang-owned token; gate on leading #include + version 12.8; load the status fn outside the X-macro; NO_PCH_CREATE_ATTEMPTED ≠ reuse.
- [slang-rhi global task pool is NOT on the single-entry-point render-test repro path](../learnings/1788199925073-slang-rhi-global-task-pool-is-not-on-single-entry-.md) — #12706; breakpoint on the pool creation fn was never hit; ~29 threads were lavapipe's; thread count ≠ pool identity; glibc-2.35-gated.
- [slang-rhi rejects C++17 if-init statements (diverges from slang compiler)](../learnings/1788361969335-slang-rhi-rejects-c-17-if-init-statements-diverges.md) — PR #845; declare the variable on its own line; the compiler-repo if-init recommendation must not carry into slang-rhi.
- [slang-rhi pNext hazard: never add multiple SIMPLE_EXTENSION_FEATURE blocks for one struct](../learnings/1788373676487-slang-rhi-pnext-hazard-never-add-multiple-simple-e.md) — slang-rhi#850; addFeatureExtension self-links; a second call → cyclic pNext → driver hang; add guarded per-subfeature push_backs inside one chained block.
