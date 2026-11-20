---
type: triage
---
# Triage: shader-slang/slang#14567 — C++ target: -fp-mode precise leaves no trace in the generated source, so Clang/GCC contract a*b+c into an FMA
Date: 2026-11-18 | Category: feature-request (with a bug sub-item: slang-llvm drops Precise) | Severity: medium | Priority: P2 | Component: target-emit (C++/CPU) + slang-llvm
Duplicate: no (siblings #14036 CUDA / #13689 Metal are related, not dups). Reporter albertrodriguezclo (CONTRIBUTOR; same as #14036/#13689).

## What's broken / being requested
With `-target cpp`, `-fp-mode precise` (and `fast`) never materialize into the emitted C++ source, so the app's own
Clang/GCC freely contracts `a*b+c` into FMA. Also, slang-llvm's embedded-Clang invocation (host-callable path) handles
only Fast (`opts.FastMath=true`); Precise sets no `FPContractMode`. Contrast: SPIR-V emits NoContraction under precise
(PR #11935), NVRTC gets `--fmad=false` (#12801), and Slang-driven gcc/clang downstream compiles pass
`-ffp-contract=off -fno-fast-math` for Precise (slang-gcc-compiler-util.cpp:1072-1091) — only app-compiled cpp text
and slang-llvm are unprotected.

## Repro (VERIFIED on master e06dc840a95eb, local slangc rebuilt first — scratch-14567/)
- `slangc fma.slang -target cpp -stage compute -entry computeMain -fp-mode precise -o fma.cpp` → `computeMain`
  contains bare `(a*b)+c`; grep for pragma/contract/fp-define = zero hits. Confirmed the core claim.
- Downstream contraction verified: g++ 12.2 `-O2 -march=haswell` emits `vfmadd132ss` for the emitted expression.
  clang frontend fuses under its C++ default `-ffp-contract=on`: `a*b+c` → `llvm.fmuladd.f32` (container clang 14's
  x86 backend happens not to lower it, so asm-level fusion not observable here; reporter proved it on clang-cl 19).
- Fix-lever verification: `#pragma STDC FP_CONTRACT OFF` → clang emits separate `fmul`+`fadd` (works, file-scope);
  GCC ≤13 SILENTLY IGNORES the pragma and still fuses (verified gcc 12); honored only since GCC 14. MSVC ignores the
  pragma but does not contract under its default /fp:precise. nvcc ignores all such pragmas (domain file) — CUDA
  needed `_rn` intrinsics instead (#14396); cpp does not need that, pragmas suffice for clang/GCC≥14.

## Codebase digest (read at e06dc840a95eb; re-verify before citing)
- slang-emit-cpp.h:17 `CPPSourceEmitter` : `CLikeSourceEmitter` — has NO `emitFrontMatterImpl` override; base at
  slang-emit-c-like.cpp:124-131 (only `#pragma once` for hpp). Nothing in slang-emit-cpp.cpp reads fp mode.
- Precedent hook: `CUDASourceEmitter::emitFrontMatterImpl`, slang-emit-cuda.cpp:401-411 — emits
  `#define SLANG_CUDA_ENABLE_FAST_MATH 1` under Fast; comment at :404-405 notes ordering vs prelude. CUDA derives
  FROM CPP (slang-emit-cuda.h:44), so a cpp-level override must not change CUDA's inherited behavior unintentionally
  (CUDA front matter would run its own override first/instead).
- Emit order: `emitFrontMatter` (slang-emit.cpp:3248) → embedded prelude at :3259-3261 via
  `Session::getPreludeForLanguage` (slang-global-session.cpp:125-128; cpp prelude = prelude/slang-cpp-prelude.h)
  → `emitPreModule`. A front-matter pragma lands before prelude and module code — file-scope STDC pragma applies
  from its point onward, so that ordering works.
- Global mode getter: `getFloatingPointMode()` (slang-compiler-options.h:418-420). Effective-mode logic
  (global vs `IRFloatingPointModeOverrideDecoration`, slang-ir-insts.h:804-811; autodiff adds Fast at
  slang-ir-autodiff-fwd.cpp:2271) is duplicated SPIRV-privately (slang-emit-spirv.cpp:10755-10765) and in
  slang-ir-peephole.cpp:21,371-373; no shared util. Front matter is module-scope → global mode alone is the input.
- E56005: `CPPSourceEmitter::emitTempModifiers` slang-emit-cpp.cpp:1305-1313 warns `precise` unsupported on target —
  OUT OF SCOPE here (per-value precise belongs to #13324 / #14036 remainder).
- slang-llvm: source/slang-llvm/slang-llvm.cpp:754-760 — only `Fast` → `opts.FastMath=true`; Precise falls through.
  Precise fix = `opts.FPContractMode = clang::LangOptions::FPM_Off` (in-process equivalent of `-ffp-contract=off`;
  FastMath=false is already the default). Triple = LLVM_DEFAULT_TARGET_TRIPLE (:737); JIT feature detection adds host
  features (slang-llvm-jit-shared-library.cpp:215-257, AVX-512 opt-out via SLANG_DISABLE_AVX512) — on AArch64 hosts
  FMA is base ISA, so the gap is live there (reporter's point, not hardware-verified by us).
  slang-llvm is a runtime-loaded module (cmake/LLVM.cmake:56-72; loaded in slang-llvm-compiler.cpp:17), embedded LLVM
  21.1.2. Host-callable reaches it via PassThroughMode::LLVM (slang-code-gen.cpp:734-741; fp mode mapped at :835-845).

## Candidate approaches
  ### Approach A: front-matter `#pragma STDC FP_CONTRACT OFF` (+ per-compiler guards) under Precise
    - Where: new `CPPSourceEmitter::emitFrontMatterImpl` (slang-emit-cpp.cpp / .h), mirror slang-emit-cuda.cpp:401-411;
      condition on `getFloatingPointMode() == FloatingPointMode::Precise` (compiler option).
    - Behaviour delta: emitted cpp/h starts with the pragma; clang + GCC≥14 stop contracting; MSVC unaffected (no
      contraction by default); GCC≤13 silently ignores (residual gap → document).
    - Tradeoffs: smallest change, standard C99 pragma, file-scope; consistent with SPIR-V/CUDA precedents of making
      the mode leave a trace. Optional `#if defined(__clang__) || defined(__GNUC__)` guard to avoid MSVC C4068 noise
      (verify whether MSVC warns on STDC pragmas; if it stays silent, emit unguarded).
    - Risk: none structural; CUDA subclass override unaffected (its own emitFrontMatterImpl wins). Test via filecheck
      on emitted source (CHECK pragma under -fp-mode precise; CHECK-NOT under default/fast).
  ### Approach B: slang-llvm precise-mode LangOpts (bug fix)
    - Where: source/slang-llvm/slang-llvm.cpp:756-760 — add Precise branch setting `opts.FPContractMode = FPM_Off`.
    - Behaviour delta: host-callable JIT no longer contracts under precise (AArch64 hosts esp.).
    - Tradeoffs: tiny; mirrors what gcc downstream already does with the flag; needs rebuilt slang-llvm module to take
      effect (prebuilt binary fetch default — note in PR).
    - Risk: low; only changes precise-mode behavior.
  ### Approach C: documentation-only ("compile with -ffp-contract=off")
    - Rejected as primary: SPIR-V/CUDA/NVRTC/GCC-downstream precedents chose source/toolchain-level guarantees;
      docs alone leaves the documented way to use -target cpp (app compiles it) unprotected.

## Recommended path
A + B in one PR (same issue, two levers). Scope guards: global `-fp-mode precise` only — per-value `precise`
keyword / E56005 stay out (#13324 / #14036 remainder); do not touch CUDA files (separate chain #14396/#14405);
non-closing PR ref "Part of #14567". Watch for a reporter self-PR (albertrodriguezclo self-fixed #13689 via #13943).
Open question to flag in PR (same as #14396): should the autodiff Fast `IRFloatingPointModeOverrideDecoration` win
over the global Precise pragma? Front matter is module-scope → can't be per-function; keep pragma on global mode.

## Sources
- Local code read at e06dc840a95eb (2 explore subagents, 2026-11-18); DeepWiki Q&A 2026-11-18: cpp emitter has no
  fp-mode front-matter (CUDA-only fast-math define confirmed); slang-llvm precise gap confirmed.
- Shared wiki concepts: slang-backends-cuda-nvrtc-vs-offline-nvcc.md, slang-backends-spirv-precise-and-nocontraction.md.
- Local experiments: scratch-14567/ (fma.cpp, t_{plain,stdc,clangfp}.cpp; clang IR fmuladd vs separate; gcc asm vfmadd).
- Chain state: [[../14036-cuda-precise-fp-mode-rn-intrinsics.md]] (draft PR #14396, non-closing, in slang-fixer's hands), #13689
  (Metal; parked, no chain record — reporter PR #13943 merged), #14405 (human non-draft CUDA PR, pending operator decision).
