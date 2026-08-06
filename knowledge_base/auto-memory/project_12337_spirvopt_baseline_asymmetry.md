---
name: project_12337_spirvopt_baseline_asymmetry
description: "#12337 — tangent-vector's spirv-opt baseline-fairness question ANSWERED FROM SOURCE at b0e43d657: glslangValidator's optimizer is OFF by default for GLSL input (SpvOptions.disableOptimizer{true} + gate needs prelegalization||optimizeSize, and prelegalization is HLSL-only) while Slang's default IS -O1 (getDefault→OptimizationLevel::Default) ⇒ his asymmetry is REAL and DEFAULT-ON, not hypothetical. ALSO a correction to #12337's own step 2: the emitEntryPointsSourceFromIR bucket it named does NOT cover -target spirv (direct path bypasses it), and spirv-opt has NO timer at all"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7f2ee89f-fbf7-4fff-8adb-0996d3833724
---

# #12337 — the spirv-opt baseline question, answered from source

**Inbound:** `tangent-vector` comment
[`5195598507`](https://github.com/shader-slang/slang/issues/12337#issuecomment-5195598507),
2026-08-05, on #12337. First **non-bot** comment on the issue — this is the RESUME trigger the chain
note named, and it fired.

His question, in two parts:
1. Did the comparison points (`h7per`'s glslang benchmark) go through spirv-opt or not?
2. Framing: *"It wouldn't be realistic for us to aspire to have Slang compilation that goes through
   spirv-opt be faster than glslValidator compilation that doesn't use spirv-opt."*

## Answer — the asymmetry is real, and it is the DEFAULT on both sides

Verified in the tree at **`b0e43d657`** (note: HEAD moved from `0864e60e6` since the filing).
Both halves are default-path facts, not flag-dependent edge cases.

**glslangValidator: optimizer OFF by default for GLSL input.**
- `external/glslang/SPIRV/GlslangToSpv.h:50-51` — `bool disableOptimizer {true};` and
  `bool optimizeSize {false};` are the **struct defaults**.
- `external/glslang/StandAlone/StandAlone.cpp:1587-1588` only ever sets `disableOptimizer` from
  `-Od` and `optimizeSize` from `-Os`; with neither flag `disableOptimizer` keeps its `{true}` default.
- The gate, `external/glslang/SPIRV/GlslangToSpv.cpp:11878-11881`:
  ```cpp
  bool prelegalization = intermediate.getSource() == EShSourceHlsl;
  if ((prelegalization || options->optimizeSize) && !options->disableOptimizer) {
      SpirvToolsTransform(intermediate, spirv, logger, options);
  ```
  ⭐ **`prelegalization` is `EShSourceHlsl` — HLSL only.** So for **GLSL** input with no `-Os`, the
  condition is false on *both* operands and `SpirvToolsTransform` never runs. A GLSL→SPIR-V
  `glslangValidator` run does **zero** spirv-opt work.
- What it *would* run if enabled is not small: `SpvTools.cpp:185-228` registers ~24 passes
  (WrapOpKill, DeadBranchElim, MergeReturn, InlineExhaustive, ScalarReplacement, 3× AggressiveDCE,
  2× VectorDCE, IfConversion, BlockMerge, CFGCleanup, …).

**Slang: optimizer ON by default.**
- `source/slang/slang-compiler-options.cpp:458-459` —
  `case CompilerOptionName::Optimization: return CompilerOptionValue::fromEnum(OptimizationLevel::Default);`
  i.e. absent any `-O` flag the level is **Default (= `-O1`)**, not `None`.
- `source/slang/slang-emit.cpp:3383-3387` — `needsOptimization` is true whenever the level
  `!= OptimizationLevel::None` (or any `-Xspirv-opt` flag is present), and that is one of the four
  conditions that load `slang-glslang` and run the optimizer.
- The `SLANG_OPTIMIZATION_LEVEL_DEFAULT` arm at `source/slang-glslang/slang-glslang.cpp:344-380`
  (the live `#elif 1`) registers ~14 passes.

⇒ **`slangc file.slang -target spirv` vs `glslangValidator file.frag -o out.spv` is
~14-passes-of-spirv-opt vs ZERO.** His concern is not a caveat to check — it is the default
configuration of the exact comparison `h7per` reported (80 ms vs 120 ms). ⭐ **He asked whether the
baseline includes spirv-opt work; the answer is "no, and ours includes it *without being asked*",
which is stronger than the question presumed.**

⚠️ **Honest limits — three, and they matter:**
1. `h7per`'s **exact invocation is unknown.** I verified what the *defaults* are; I did not observe
   his command line. If he passed `-Os` to glslang, or `-O0` to Slang, the asymmetry inverts or
   vanishes. **The flags are the one thing only he can supply** — and that makes this a concrete,
   answerable question to put to him, which is more actionable than the repro ask alone.
2. Whether spirv-opt is *the* bottleneck remains unmeasured. This establishes an **unfair baseline**,
   not a diagnosis. ⛔ Do not let it become one — that is #12337's own stated failure mode.
3. `codingdaniel`'s ~40 s cold compile is a **different scenario** from `h7per`'s 80/120 ms
   microbenchmark; this finding lands on `h7per`'s datapoint and says nothing about the 40 s one.

## A correction to #12337's own step 2 (found while checking his question)

#12337 says confirming backend-codegen dominance "needs no compiler change — it needs the harness
pointed at one of these workloads", citing `generateOutput → emitEntryPointsSourceFromIR` as the
named bucket (`tools/compile-perf/breakdown.py:56`). **Two defects, and the second is the sharper one:**

1. **`emitEntryPointsSourceFromIR` does not cover `-target spirv`.**
   `source/slang/slang-code-gen.cpp:99` `emitEntryPointsSource` reaches it at `:165` only via its
   `else` branch. For SPIR-V, `_emitEntryPoints` takes
   `case CodeGenTarget::SPIRV:` at `slang-code-gen.cpp:1184-1188` and calls
   `emitSPIRVForEntryPointsDirectly` (whenever `shouldEmitSPIRVDirectly()` — true unless
   `-emit-spirv-via-glsl`, `slang-compiler-options.h:340-346`), **returning before** the fallthrough.
   `emitSPIRVForEntryPointsDirectly` (`slang-emit.cpp:3499`) carries **no `SLANG_PROFILE`**.
   ⇒ For the SPIR-V direct path — the path all three users are on — the issue's named bucket is
   **empty**, and the work lands in the `generateOutput (self)` residual.
2. **spirv-opt has no timer anywhere.** `grep -c SLANG_PROFILE` over
   `source/compiler-core/slang-glslang-compiler.cpp` = **0**, and
   `grep -niE 'spirv.?opt|glslang|downstream' tools/compile-perf/breakdown.py` = **0 buckets**.
   The downstream optimizer call (`slang-glslang-compiler.cpp:270`,
   `request.action = GLSLANG_ACTION_OPTIMIZE_SPIRV`) is untimed and unbucketed.

⭐⭐ **So the harness cannot currently answer tangent-vector's question, and the issue asserts it can.**
It would report spirv-opt time inside `generateOutput (self)` — a residual, which per #12337's own
profiler caveat (flat dict keyed by function name, `slang-performance-profiler.cpp:10`, tree
reconstructed by `breakdown.py`) is exactly where unattributed cost hides. ⭐⭐⭐ **A named bucket that
is EMPTY for the configuration under test reads identically to a bucket showing low cost — this is
the [[feedback_a_guard_can_be_inert_and_read_as_passing]] shape applied to a profiler.** Step 2 needs
**one `SLANG_PROFILE` and one bucket**, not zero code change. That is a small, well-scoped change —
but it is not nothing, and the issue promises nothing.

⚠️ Symmetric caveat on my own claim: `-report-perf-benchmark` prints **every** `SLANG_PROFILE`d
function, so `compileInner`/`generateOutput` totals still bound the cost — the time is *not lost*,
it is **unattributed**. My claim is "cannot attribute spirv-opt", **not** "cannot see it".

## Also verified

`#if 0` at `source/slang/slang-emit.cpp:3312-3318` — the *inline* `optimizeSPIRV(spirv, ...)` call in
`createArtifactFromIR` is **dead code**, not the live path; the real optimizer invocation is the
`needsDownstreamCompiler` gate below it. ⭐ Reading the first `optimizeSPIRV` grep hit as the live
call would have produced a confidently wrong mechanism.

## Disposition

Dispatched to **slang-triager** on the canonical thread, pinned to its filing session — it owns the
public artifact and made the step-2 claim, so the correction is its to post
([[feedback_dont_post_and_delegate_same_write]] — I post nothing myself). A maintainer asked a direct
question, so **a GitHub reply is owed**; per [[feedback_github_writes_operator_authorized]] a
HEAD-verified answer posts on the bot's own authority, no operator gate.

⭐⭐ **This is why "own-bot echo ⇒ no dispatch" was scoped to re-triage only.** The chain looked
terminal-pending-repro; a maintainer question arrived and it had verifiable content underneath.
[[feedback_an_in_place_edit_notifies_nobody]] applies to the reply shape: answer as a **new comment**
(he gets notified), never by editing an earlier one.

**RESUME:** `h7per` supplies his glslang/Slang invocations (settles limit 1); the reproducer lands;
or a maintainer acts on the missing-timer gap. ⛔ Do **not** convert the baseline asymmetry into a
"spirv-opt is the bottleneck" diagnosis — it is a fairness finding, and #12337's whole discipline is
not earning diagnoses it hasn't measured.
