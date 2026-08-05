---
title: "CORRECTION: recommend a test shape against the BUILD graph, not the call graph (slang #12212 in-process test was unbuildable)"
type: learning
topic: slang-compiler
source: learnings/1785840768185-correction-recommend-a-test-shape-against-the-buil.md
---

# CORRECTION: recommend a test shape against the BUILD graph, not the call graph (slang #12212 in-process test was unbuildable)

## Correction to my own #12212 triage recommendation

My triage memo for shader-slang/slang#12212 recommended the "lightest lock" regression test as an
**in-process** `slang-unit-test` asserting `parseDefs() → SLANG_FAIL` and `getErrorCount() > 0` on an
in-memory capdef. **That test is unbuildable.** Verified myself on `origin/master`:

- `git grep -ln CapabilityDefParser origin/master` → exactly ONE file,
  `tools/slang-capability-generator/capability-generator-main.cpp`. No header, no library.
- `tools/CMakeLists.txt:80` → `generator(slang-capability-generator LINK_WITH_PRIVATE compiler-core)`
  builds it as an **executable with no library target**, so nothing can link the parser.

The shipped fix (PR #12217, merged `f282bdf9c0`) correctly used a **subprocess** test
(`tools/slang-unit-test/unit-test-capability-generator.cpp`) that runs the built generator and asserts
the diagnostic + nonzero exit + no output files. That was **necessary, not a stylistic preference** —
and it locks the tool-exit-code contract, which is the actual invariant the issue is about and which
the in-process variant would have missed entirely.

**Rule:** when recommending a test shape, check the **build graph** (is the symbol in a linkable
library target?), not just the call graph (is the function reachable in source?). "Just unit-test the
function directly" is only advice if the function lives somewhere a test binary can link. For anything
defined inside a `main.cpp` of a build-time generator/tool, the only route is a subprocess test.
Corollary: for a bug whose symptom IS the process exit code, a subprocess test is the *only* shape that
tests the real contract — an in-process test of the internal helper would pass while the tool still
exited 0.

## Related gotcha: a "minimal repro" that fails via a DIFFERENT error is a false-positive test

For capdef error 20007 (`missingExternalInternalAtomPair`), a bare `def _foo : stage;` does **not**
produce 20007 — it produces **error 20003 (undefined identifier "stage")**, a different and already
nonzero-exit path. A test built on that would pass **for the wrong reason** and would keep passing if
the 20007 propagation regressed. The real minimal repro must declare the abstract atom first:
`abstract stage;\ndef _foo : stage;`.

Generalizes: when writing a regression test that asserts "tool fails," confirm it fails via **the
specific diagnostic under test** (grep the expected error code in stderr), not merely that it failed.
Otherwise a pre-existing unrelated failure path silently satisfies the assertion.

## Ancillary: generator binaries live in a sibling tree
Build-time generators land in `build/generators/<config>/bin/`, a sibling of the unit-test binary's
`build/<config>/bin/`. A test spawning one must derive the path from `executableDirectory` by walking
up and back down into `generators/<config>/bin/`, and skip gracefully (`SLANG_IGNORE_TEST`) when absent
— cross-compiled layouts place it at an external `SLANG_GENERATORS_PATH`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785840768185-correction-recommend-a-test-shape-against-the-buil.md`_
