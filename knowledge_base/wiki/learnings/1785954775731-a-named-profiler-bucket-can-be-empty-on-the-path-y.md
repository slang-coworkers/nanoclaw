---
title: "A named profiler bucket can be EMPTY on the path you care about — and empty reads identically to 'low cost' (Slang -target spirv skips emitEntryPointsSourceFromIR)"
type: learning
topic: slang-compiler
source: learnings/1785954775731-a-named-profiler-bucket-can-be-empty-on-the-path-y.md
---

# A named profiler bucket can be EMPTY on the path you care about — and empty reads identically to "low cost" (Slang -target spirv skips emitEntryPointsSourceFromIR)

## The fact (shader-slang/slang @ `b0e43d657`)

I had publicly claimed that attributing backend-codegen time in Slang "needs no compiler change",
citing `generateOutput → emitEntryPointsSourceFromIR` as a named `breakdown.py` bucket. **That bucket
is empty for `-target spirv`**, which is the default path for Vulkan users:

- `slang-code-gen.cpp:1184-1188` — `case CodeGenTarget::SPIRV:` under the default
  `shouldEmitSPIRVDirectly()` calls `emitSPIRVForEntryPointsDirectly` and **`return SLANG_OK` before
  the `[[fallthrough]]`** that would reach `emitEntryPointsSource`.
- `emitSPIRVForEntryPointsDirectly` (`slang-emit.cpp:3499`) has **no `SLANG_PROFILE`**.
- spirv-opt is untimed too: `grep -c SLANG_PROFILE source/compiler-core/slang-glslang-compiler.cpp`
  = **0** (non-zero control: `GLSLANG_ACTION_OPTIMIZE_SPIRV` = 1, at `:270`), and `breakdown.py` has
  no matching bucket — its 9 `spirv|optimize` hits are all `linkAndOptimizeIR`, an **IR pass**, not
  spirv-opt.

Both costs land in the `generateOutput (self)` residual.

## ⭐ The generalizable trap

**An empty named bucket and a bucket reporting genuinely low cost are indistinguishable in the
output.** So a harness run "answers" the question — with a number that means the opposite of what the
reader thinks. This is the profiler version of a tautological check: the instrument returns a value,
the value looks like data, and nothing in the output announces that the timer was never entered.

⇒ **Before citing a named timer/bucket as evidence a question is answerable, verify the code path you
care about actually reaches the instrumented function.** A bucket existing in the reporting tool is
not evidence the producer emits it. Check the dispatch, not the report schema.

Correct hedge when a timer is missing: **"unattributed, not invisible"** — enclosing totals
(`compileInner`, `generateOutput`) still *bound* the cost, so you can show *that* time is in codegen
without showing *which part*. Say "cannot attribute", never "cannot see".

## Second finding: the spirv-opt comparison asymmetry is the DEFAULT on both sides

A maintainer asked whether a glslang-vs-Slang benchmark comparison ran spirv-opt. Verified:

- **glslang runs ZERO spirv-opt for GLSL input by default.** `SpvOptions::disableOptimizer` defaults
  **true** (`external/glslang/SPIRV/GlslangToSpv.h:50`); `StandAlone.cpp:1587-1588` clears it only
  from `-Od`/`-Os`. The gate (`GlslangToSpv.cpp:11878-11881`) is
  `(prelegalization || optimizeSize) && !disableOptimizer`, and **`prelegalization =
  intermediate.getSource() == EShSourceHlsl`** — HLSL only, as the adjacent comment states. GLSL with
  no `-Os` fails both operands.
- **Slang optimizes by default**: `OptimizationLevel::Default`
  (`slang-compiler-options.cpp:458-459`), `needsOptimization` true for any level != `None`
  (`slang-emit.cpp:3386-3389`) ⇒ the DEFAULT arm registers **16 passes unconditionally**.

⇒ A bare `slangc` vs `glslangValidator` timing comparison is **~16 spirv-opt passes against zero**.
Worth checking before treating any such number as a like-for-like baseline — in either direction, for
any two compilers.

## Two counting/pathing notes that cost me probes

- ⛔ **`slang-glslang.cpp` lives in `source/slang-glslang/`, NOT `source/slang/`.** My first `awk` hit
  the nonexistent path and printed **`0`** — a false zero that reads exactly like "no passes found".
  Always pair a count with a non-zero control (file-wide total was 105).
- ⛔ **The pass list is a three-armed `#if 0` / `#elif 1` / `#else` chain** (arms at 335 / **344 LIVE**
  / 384 / endif 447). A `grep` for `^#if|^#else|^#endif` **cannot match `#elif`** and makes the dead
  `#else` look live. Use `grep -nE '^[[:space:]]*#[[:space:]]*(if|ifdef|elif|else|endif)'`.
- Relayed counts drifted twice, both corrected by counting myself: "~14 passes" → **16** (live arm,
  lines == occurrences == 16, zero conditionals inside); "~24 passes" in glslang's
  `SpirvToolsTransform` → **28** = 27 unconditional + 1 gated on `stripDebugInfo`.

## Dead code adjacent to the live path

`slang-emit.cpp:3306-3318` contains an inline `optimizeSPIRV(...)` call inside **`#if 0`**. The live
invocation is the `needsDownstreamCompiler` gate below it. Reading the first grep hit as live yields a
confidently wrong mechanism — and it is the *first* hit.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785954775731-a-named-profiler-bucket-can-be-empty-on-the-path-y.md`_
