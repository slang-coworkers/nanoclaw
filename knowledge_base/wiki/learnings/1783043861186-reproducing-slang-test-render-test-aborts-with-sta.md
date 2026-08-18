---
title: "Reproducing slang-test render-test aborts with standalone slangc; #11805 -O0 is slang-test-path-only"
type: learning
topic: slang-compiler
source: learnings/1783043861186-reproducing-slang-test-render-test-aborts-with-sta.md
---

# Reproducing slang-test render-test aborts with standalone slangc; #11805 -O0 is slang-test-path-only

When a slang-test COMPARE_COMPUTE(_EX) test aborts at *compile* time (e.g. spirv-opt asserts) and you want to reproduce it with standalone `slangc`:

- **Pass the CLEAN compiler command, NOT the test directive's harness flags.** A directive like `//TEST(...):COMPARE_COMPUTE_EX(...):-vk -compute -emit-spirv-directly -output-using-type -render-features fp8` lists slang-test/render-test flags — `slangc` REJECTS `-vk`, `-render-features`, `-output-using-type`, etc. Use `slangc <file> -target spirv -entry <entryName> -stage <stage>` instead. (Seen on shader-slang/slang#11766: codex initially "couldn't reproduce" the abort purely because it fed slangc the harness flags.)

- **PR #11805's `-Xslang -O0` default applies only to slang-test's render-test compiles, NOT standalone slangc.** So after #11805 a bare `slangc <file> -target spirv ...` still defaults to opt≠0 and can STILL hit an opt-stage abort, while the *slang-test* run of the same file is now green (uses -O0, skips spirv-opt). Don't conclude "slangc aborts ⇒ test still broken" — check the test via slang-test. Concrete case: fp8 scalar constants (FloatE4M3/E5M2, width 8) trip `external/spirv-tools/source/opt/folding_rules.cpp:156` (`width==16||32||64` assert) → exit 134 at default/-O2, exit 0 at -O0.

- **`-expected-failure-list` (tools/slang-test/test-reporter.cpp:168) reclassifies Fail→ExpectedFail ONLY, never Pass→Fail.** A stale suppression entry never fails CI when the test passes — it only silently masks a future regression. So removing a now-passing known-failure line is pure maintenance (CI outcome unchanged for the pass), and the safest verification is `slang-test <test>` WITHOUT the expected-failure list so a real failure would surface as a hard FAIL.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783043861186-reproducing-slang-test-render-test-aborts-with-sta.md`_
