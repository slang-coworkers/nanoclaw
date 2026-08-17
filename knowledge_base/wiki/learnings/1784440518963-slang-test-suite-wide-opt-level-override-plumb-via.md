---
title: "slang-test suite-wide opt-level override: plumb via context-&gt;options through the two addDefault* helpers"
type: learning
topic: slang-compiler
source: learnings/1784440518963-slang-test-suite-wide-opt-level-override-plumb-via.md
---

# slang-test suite-wide opt-level override: plumb via context-&gt;options through the two addDefault* helpers

**Context:** shader-slang/slang#11988 (nightly slang-test with SpvOpt forced on) — jkwak's design needed "a new slang-test command-line arg to change the DEFAULT optimization level suite-wide."

**Where the -O0 default lives (post-#11805):** `tools/slang-test/slang-test-optimization-options.h`
- `kTestOptimizationOption = "-O0"` (:14) — the hard-coded suite-wide default.
- `kMetalRenderTestOptimizationOption = "-O1"` (:23) — Metal render-test exception (macOS metal toolchain flakes at -O0; generated MSL is identical at every level).
- `addDefaultSlangOptimization(CommandLine&)` (:66) — inserts `-O0` at index 0 for compiler-backed tests unless the test already has a `-O` (checked by `hasSlangOptimizationArg` / `isSlangOptimizationArg`, which validate against slangc's level names).
- `addDefaultRenderTestSlangOptimization(CommandLine&)` (:126) — inserts `-Xslang <level>` at front for render-test-backed tests (Metal→-O1 else -O0).
- **Front-insertion is deliberate**: an appended `-O0` would be consumed as the argument of a diagnostic test's intentionally-dangling trailing flag (e.g. trailing `-target`) and change the diagnostic.

**Clean override plumbing:** add `Slang::String defaultOptimizationLevel;` to `Options` (options.h), parse a new flag in `Options::parse()` (options.cpp) + help line, thread an override param (defaulting to `kTestOptimizationOption`) into BOTH `addDefault*` helpers, and pass `context->options.defaultOptimizationLevel` at the ~16 call sites in `slang-test-main.cpp`. **`TestContext::options` is a PUBLIC member (test-context.h:150) and every injection call site already has a `TestContext* context` in scope** — so no signature churn beyond the helpers. Extend `tools/slang-unit-test/unit-test-slang-test-optimization-options.cpp` (CPU-only, no GPU) to assert the override.

**Which level enables spirv-opt:** `source/slang-glslang/slang-glslang.cpp:275` — `if (optimizationLevel == SLANG_OPTIMIZATION_LEVEL_NONE) return;` is the SOLE spirv-opt early-out. Any level ≥ default runs the optimizer; the switch at :317 selects progressively larger pass sets. slangc opt-level spellings (`slang-type-text-util.cpp:199`): `0/none`, `1/default`, `2/high`, `3/maximal`. So "force max SpvOpt suite-wide" = pass `-O3`/maximal.

**DeepWiki caveat:** DeepWiki's index is pre-#11805 and INCORRECTLY claims slang-test doesn't inject -O0. Local source at HEAD is authoritative here.

**Bot deliverable split (recurring):** when a task needs both source AND a `.github/workflows/*.yml`, the nv-slang-bot App lacks the `workflows` permission — pushing the .yml to the PR branch is REJECTED. Put source in the draft PR; author the workflow file and post it as a fenced-diff comment on the issue/PR for a maintainer to apply by hand; note the split in the PR description. Free daily nightly cron slot as of 2026-07: 01:00 UTC (02:00 coverage/sanitizer, 03:00 remix, 04:00 slang-test/sascha, 05:00 mdl-perf, 06:00 analytics, 07:00 vkglcts/pr-sweep are taken).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784440518963-slang-test-suite-wide-opt-level-override-plumb-via.md`_
