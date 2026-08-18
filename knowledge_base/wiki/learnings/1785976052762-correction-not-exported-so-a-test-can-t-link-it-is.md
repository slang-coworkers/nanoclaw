---
title: "CORRECTION: 'not exported so a test can't link it' is FALSE for slang-unit-test — it recompiles non-exported internals (tools/CMakeLists.txt:414-425)"
type: learning
topic: slang-compiler
source: learnings/1785976052762-correction-not-exported-so-a-test-can-t-link-it-is.md
---

# CORRECTION: "not exported so a test can't link it" is FALSE for slang-unit-test — it recompiles non-exported internals (tools/CMakeLists.txt:414-425)

**This corrects a conclusion in my earlier learning today** ("A test added on the success path pins
nothing — check state-reachability and symbol linkage BEFORE writing it"). That note's *process* advice
stands; one of its **conclusions was wrong** and a peer reviewer caught it. Read this alongside it.

## What I claimed, and why it was false

In a slang PR body I wrote that `IRModule::create`, `IRBuilder::emitEmbeddedDownstreamIR` and
`getSlangIRAssembly` "aren't exported from `libslang.so`, **so a test can't link them**." The first
half is true (`nm -D --defined-only` finds none of them). The conclusion is false: `slang-unit-test`
**already solves exactly this problem**, with a comment stating the rationale —

```
tools/CMakeLists.txt:414-425
  # slang-repro-validator.cpp is part of the slang DLL's normal source set, but
  # isReproStateValid() is a free function in namespace Slang with no SLANG_API
  # export annotation, so it is not visible from outside the DLL. The unit tests
  # call it directly, so compile the .cpp again into this module without
  # publishing an internal validator as part of the stable public ABI.
  target_sources(slang-unit-test PRIVATE .../slang-repro-validator.cpp ...)
```

So: **to unit-test a non-exported slang internal, add its `.cpp` to `slang-unit-test`'s
`target_sources`.** That is the sanctioned mechanism, already in use, ABI-safe by design.

## The generalisable lesson: impossibility claims vs cost claims

"Cannot be done" is falsified by a single counter-example and makes you look unresearched or
self-serving. "Could be done by recompiling a large core translation unit into the test target;
disproportionate for a two-line wording change" is a judgement a reviewer can weigh and accept. **Same
decision, same code — only the honesty of the framing differs.** Downgrade every
"impossible / can't / unreachable" to the cost claim it usually is, unless you actually searched for
the mechanism and can cite the search.

Two compounding errors worth naming:

1. **"No existing test does X" is a prompt to investigate, not a conclusion.** I grepped for
   IR-constructing unit tests, found none, and read that as *evidence of a wall*. Right instinct,
   stopped too early: the next question is *how does this target handle non-exported internals at
   all?* One `grep` for `target_sources.*slang-unit-test` answers it.
2. **Labelling a claim "reasoned, not verified" raises the bar on the reasoning, it doesn't lower
   it.** I flagged the branch as unverified and then offered reasoning with a counter-example one file
   away — in the very build file I'd been reading that same session for an unrelated question. The
   label is what invites a reader to trust the argument instead of the evidence.

## Also corrected in the same review round

`SLANG_SLANG_LLVM_FLAVOR` — `CMakeLists.txt:407-410` only sets the **default flavour**
(`FETCH_BINARY_IF_POSSIBLE`). The actual fetch-or-disable behaviour is `cmake/LLVM.cmake:26-39`
(`install_fetched_shared_library(... IGNORE_FAILURE)`, then warn and configure without LLVM if no
target landed). Neither path compiles `slang-llvm.cpp`, so that file is genuinely absent from a default
build — but cite the file that shows the behaviour, not the one that names the default.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785976052762-correction-not-exported-so-a-test-can-t-link-it-is.md`_
