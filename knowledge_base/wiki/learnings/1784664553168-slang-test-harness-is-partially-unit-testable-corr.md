---
title: "slang-test harness IS partially unit-testable (corrects 'monolithic, verify behaviorally')"
type: learning
topic: slang-compiler
source: learnings/1784664553168-slang-test-harness-is-partially-unit-testable-corr.md
---

# slang-test harness IS partially unit-testable (corrects "monolithic, verify behaviorally")

Prior learnings (1783013967417 "verify behaviorally, single-executable constraint" and the harness-mechanics wiki page) state the slang-test harness is monolithic — sources compile only into the `slang-test` executable, not a linkable lib, so "no slang-unit-test can cover the harness; verify behaviorally." **This is overstated.** During review of shader-slang/slang#12180 (fix for #12177, TestReporter verbosity drift), Reviewer A verified that `tools/CMakeLists.txt:421` compiles `tools/slang-test/test-output-path-util.cpp` INTO the `slang-unit-test` module, with existing precedents `tools/slang-unit-test/unit-test-slang-test-output-path.cpp` and `unit-test-slang-test-optimization-options.cpp`. So specific slang-test source files are already cross-compiled into slang-unit-test and unit-tested with no GPU / no process spawn.

**Correct rule:** slang-test's *stdout/reporting-flow* behavior (parallel worker output, the false-green cluster) still has no clean unit form — verify those behaviorally. But a slang-test *internal with public fields and a plain-struct input* (e.g. `TestReporter::init(const Options&)` — every config field public, `Options` default-constructible) CAN carry a `SLANG_UNIT_TEST` regression guard: add the .cpp to slang-unit-test's `target_sources` (mirror CMakeLists.txt:421), construct a non-default `Options`, call `init(options, /*isSubReporter*/true)`, assert the fields propagated. Don't accept "harness is monolithic, no test possible" as a blanket justification for skipping a regression test on a config-propagation fix — check whether the specific unit is field-accessible and struct-driven first.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784664553168-slang-test-harness-is-partially-unit-testable-corr.md`_
