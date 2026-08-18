---
title: "slang-test default compiler flag needs TWO forms: bare for slangc paths, -Xslang for render-test paths"
type: learning
topic: slang-compiler
source: learnings/1782653846227-slang-test-default-compiler-flag-needs-two-forms-b.md
---

# slang-test default compiler flag needs TWO forms: bare for slangc paths, -Xslang for render-test paths

When injecting a *default* Slang compiler flag (e.g. `-O0`) into `slang-test` invocations, you cannot do it at one chokepoint, and you cannot use one spelling. Two distinct argument-assembly classes exist in `tools/slang-test/slang-test-main.cpp`:

1. **Compiler-backed tests** (runSimpleTest, runSimpleLineTest, runInterpreterTest, runCompile, runReflectionTest, runDocTest, runExecutableTest) build a `slangc` command line — append the flag bare: `-O0`.
2. **Render-test-backed tests** (runCompileTarget, runComputeComparisonImpl, doRenderComparisonTestRun, doGLSLComparisonTestRun, _runHLSLComparisonTest, runPerformanceProfile) build a `render-test` command line. **render-test's option parser REJECTS an unknown bare flag** (`tools/render-test/options.cpp` ~:366, unknownCommandLineOption). You must forward via `-Xslang <flag>` (e.g. `-Xslang -O0`), which `stripDownstreamArgs` (`source/compiler-core/slang-command-line-args.cpp:246-331`) routes into `downstreamArgs["slang"]`, retrieved in `tools/render-test/slang-support.cpp:54-60` and fed to `globalSession->parseCommandLineArguments`.

There is a single PARSE chokepoint (`_gatherTestOptions` ~:423-505 → `testOptions.args`), but injecting there is WRONG: that layer can't tell direct-slangc consumers from render-test consumers, so it would emit bare `-O0` into render-test cmdlines and they'd fail. Inject per-run-function (~15 sites), or via two helpers (one per class).

Preserve explicit test `-O*` by scanning the directive tokens: bare `-O<n>` for direct paths; for render-test also detect the forwarding wrappers `-compile-arg`/`-xslang`/`-Xslang <flag>` and the multi-arg block `-Xslang... <flags> -X.`. Note the compiler's own default opt level is `OptimizationLevel::Default`(≈O1), not None — so a slang-test `-O0` default measurably speeds the suite (observed 34m9s→11m24s, ~60%) by dropping test compiles from O1→O0.

Context: shader-slang/slang#11804 / PR #11805 (maintainer jkwak-work). Reusable for any future "default flag for tests" work.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782653846227-slang-test-default-compiler-flag-needs-two-forms-b.md`_
