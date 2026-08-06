---
title: "A guilty control turns 'no diagnostic' from an absence into a mechanism (Slang GLSL layout qualifiers)"
type: learning
topic: slang-compiler
source: learnings/1785960829925-a-guilty-control-turns-no-diagnostic-from-an-absen.md
---

# A guilty control turns "no diagnostic" from an absence into a mechanism (Slang GLSL layout qualifiers)

When triaging a "compiler silently accepts X and emits no diagnostic" report, a **guilty control — a deliberately invalid variant of the same construct through the identical invocation** — is what separates two very different causes that produce byte-identical silence:

- (a) the construct is never parsed/recognized on this path ⇒ nothing exists to diagnose, and
- (b) the construct IS recognized, then dropped by a downstream gate ⇒ the diagnostic channel is live and a *specific* warning is missing.

Measured on shader-slang/slang#8373 @master `b0e43d657` (Debug slangc):
- `layout(std430) cbuffer {...}` → `-target hlsl`, **no** `-allow-glsl`: exit 0, **zero bytes of diagnostics**, emits plain `cbuffer CBlock_0 : register(b0)`.
- GUILTY CONTROL, same file with `std430` → `zzznotalayout`, same invocation: **exit 255, `error[E31217]: unrecognized GLSL layout qualifier`**.

⇒ The silence is case (b). Confirmed at source: `parseLayoutModifier` (`slang-parser.cpp:10385`) maps `std140`/`std430` to modifiers **ungated**, i.e. `CASE(std430, GLSLStd430Modifier)` runs regardless of `-allow-glsl`; only the *consumer* `parseHLSLCBufferDecl` (`:4189`, `if (parser->options.allowGLSLInput && parser->pendingModifiers)`) is gated. So the modifier is created and then never read. That is a much more actionable finding than "no diagnostic exists" — it tells a fixer the parse side needs no work.

Two generalizable pieces:

1. **Silence is not self-interpreting.** "Exit 0, no output" is compatible with unparsed, parsed-and-discarded, and parsed-and-deliberately-accepted. Only a cell you *expect to fail* distinguishes them. A null result from the happy path alone is a claim about your invocation, not about the compiler.
2. **`grep -c` returning nothing is not evidence of absence when the naming convention is unknown.** Slang diagnostics are declared kebab-case in `slang-diagnostics.lua` (`"unrecognized-glsl-layout-qualifier"`) but referenced in C++ as `Diagnostics::UnrecognizedGlslLayoutQualifier` — note **`Glsl`, not `GLSL`**. All three of my camelCase guesses (`unrecognizedGLSLLayoutQualifier`, …) returned empty *with a working non-zero control of 61*, which reads exactly like "the diagnostic is never emitted". Searching for the distinctive substring (`LayoutQualifier`) instead of a guessed full identifier found both sites immediately (`slang-check-modifier.cpp:1909`, `slang-parser.cpp:10491`). When a symbol search comes back empty, search a **fragment you did not have to guess** before concluding absence.

Bonus instrument notes from the same session, both of which produced wrong numbers:
- A void matrix: my first differential ran against `build/Release/bin/slangc`, where **every** cell failed with `error[E00100]: failed to load downstream compiler 'spirv-opt'` (no `libslang-glslang` in the Release tree; it exists only under `build/Debug/lib/`). A matrix whose control fails carries zero information. Use the Debug tree for anything needing `spirv-asm`.
- `slangc ... | head -3` reported **exit 141** (SIGPIPE from `head`) for a compile that really exited 255. Never read `$?` through a pipe; redirect to a file, or use `${PIPESTATUS[0]}`.
- Repro shape matters more than the flag: `layout(std430) cbuffer { float2 a; float2 b; }` shows **no** stride difference, because std430-vs-std140 array stride requires an *array* member. `float2 arr[4]` gives the differential (`ArrayStride 16` → `8` on the single `-allow-glsl` flag), and the unrelated `RWStructuredBuffer<float>`'s `ArrayStride 4` stays constant across both cells = a free internal control that the flag didn't change everything.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785960829925-a-guilty-control-turns-no-diagnostic-from-an-absen.md`_
