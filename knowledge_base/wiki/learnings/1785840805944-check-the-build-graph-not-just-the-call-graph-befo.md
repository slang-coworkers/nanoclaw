---
title: "Check the BUILD graph, not just the call graph, before recommending a test shape"
type: learning
topic: ci-tooling
source: learnings/1785840805944-check-the-build-graph-not-just-the-call-graph-befo.md
---

# Check the BUILD graph, not just the call graph, before recommending a test shape

## Rule

Before recommending (or planning) a test that calls a function directly, verify the function is **linkable from the test target** — check the build graph, not just the call graph. A symbol that is trivially reachable in source may be unbuildable from a test.

## Worked case — shader-slang/slang#12212

Triage recommended a natural-looking in-process unit test: assert `parseDefs() → SLANG_FAIL` and `getErrorCount() > 0` on an in-memory invalid `.capdef`. It read as the lightest option ("no new subprocess/CTest scaffolding").

It was **unbuildable**, not merely inferior:

- `git grep -ln "struct CapabilityDefParser" origin/master` → exactly ONE hit, `tools/slang-capability-generator/capability-generator-main.cpp`. No header, no declaration anywhere else.
- `tools/CMakeLists.txt:80` → `generator(slang-capability-generator LINK_WITH_PRIVATE compiler-core)` — the `generator()` helper produces an **executable with no library target**.

So there is nothing for a unit test to link against. The parser type is internal to a `main.cpp`.

The shipped test is a **subprocess** test instead (`tools/slang-unit-test/unit-test-capability-generator.cpp`, merged in PR #12217): it runs the built generator on an intentionally-invalid capdef and asserts the diagnostic + a nonzero exit + that no output files were written.

## Why this matters beyond the mechanics

The subprocess shape was not a consolation prize — it was **strictly better coverage**. The bug in #12212 was precisely that the tool *printed* an error and still `exit(0)`, so the contract under test is the **process exit code**. An in-process `parseDefs()` assertion would have verified the return value while leaving the actual regression — the exit status the build keys off — untested. The build-graph constraint forced the shape that tested the real contract.

Generalization: when the defect is "the *tool* behaved wrong" (exit code, files written, stdout), the unit under test is the process, not the function. Reach for a subprocess test deliberately, not only when linking fails.

## Two concrete gotchas for this generator

1. **A minimal repro must declare the abstract atom first.** `abstract stage;\ndef _foo : stage;` triggers the intended `error 20007` (`missingExternalInternalAtomPair`). A bare `def _foo : stage;` instead hits `error 20003: undefined identifier "stage"` — a *different* code path that was **already** nonzero-exit before the fix. A test built on that would pass for the wrong reason both before and after: a false-positive test, which is worse than no test.
2. **The generator binary is not next to the test binary.** Build-time tools land in `build/generators/<config>/bin/`, a sibling of the unit-test binary's `build/<config>/bin/`. Derive the path from `UnitTestContext::executableDirectory` via `../../generators/<config>/bin/`, and `SLANG_IGNORE_TEST` when absent (install-only / cross-compiled `SLANG_GENERATORS_PATH` layouts put it elsewhere entirely).

## Harness reference

`tools/slang-unit-test/unit-test-depfile.cpp` is the model: `ProcessUtil::execute(cmdLine, ExecuteResult&)` returns `resultCode` + `standardOutput`/`standardError` in one call. Use `ExecutableLocation(ExecutableLocation::Type::Path, fullPath)` for an absolute path. Unit-test `.cpp` files are auto-globbed into the `slang-unit-test` MODULE target — no CMakeLists edit needed to add one.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785840805944-check-the-build-graph-not-just-the-call-graph-befo.md`_
