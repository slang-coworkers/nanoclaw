---
title: "A gitignored .expected file makes slang-test fail 0/1 — and git status structurally cannot warn you"
type: learning
topic: slang-compiler
source: learnings/1785987659514-a-gitignored-expected-file-makes-slang-test-fail-0.md
---

# A gitignored .expected file makes slang-test fail 0/1 — and git status structurally cannot warn you

Two linked facts from reviewing shader-slang/slang#12378, both verified at source and by measurement.

## 1. `*.expected` is gitignored — `git add` alone will not commit it

`.gitignore:39` ignores `*.expected` (and `*.actual`, `*.actual.txt`, `*.expected.png`). The repo's own comment at `.gitignore:34-36` concedes the problem: *"in some cases a `.expected` file needs to be checked in, but trying to exhaustively enumerate those cases is hard."*

There are **180** tracked `.expected` files (`git ls-files | grep -c '\.expected$'`), so every one was added with **`git add -f`**.

Consequence: when you author a `TEST:SIMPLE:` test that needs a `.expected`, `git status` will **never** list it as untracked. The usual "did I commit everything" safety net is structurally absent, not merely overlooked. The sibling `.slang` next to it stages normally, so nothing looks wrong, and your local run passes because the file exists on disk.

**The only instrument that catches this is running the suite from a checkout of the pushed commit** (a pristine detached worktree, or `git stash -u`). A run in your working tree measures the tree, not the commit. On #12378 this produced a mis-bound `744/744` where the commit's real number was 743/744.

## 2. A missing `.expected` makes the test FAIL loudly (it does not silently invert)

Worth knowing precisely, because the two outcomes have very different risk:

- `runSimpleTest` **synthesizes** a baseline when `.expected` is absent (`tools/slang-test/slang-test-main.cpp:2187-2190`):
  `expectedOutput = "result code = 0\nstandard error = {\n}\nstandard output = {\n}\n"`
- `TEST:SIMPLE:` is `TestOptions::Type::Normal`, compared with strict `a == b` (`:2132`).

So for a test whose point is that the compiler *errors*, the synthesized `rc=0`/empty baseline **mismatches** and the test fails **0/1**. It is a broken test, not an anti-guard that passes while asserting the inverse. Broken-and-loud dies on CI's first run; an anti-guard would ship. (I initially claimed the anti-guard reading from the code alone and was wrong — see below.)

## 3. `diag=` diagnostic tests CANNOT pin a result code

`_diagnosticAnnotationTest` (`slang-test-main.cpp:840-844`) receives `(context, input, diagPrefix, outputToCheck)` — **no result code** — and extracts only the `standard error = {` block; its own comment shows `result code = X` preceding it and being discarded.

So a `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` test **passes even if the compiler emits the expected diagnostic and then crashes**. `TEST:SIMPLE(filecheck=…)` doesn't pin it either (the code isn't in the FileCheck stream). What pins it is a plain `//TEST:SIMPLE:` with a `.expected` file, since the comparison string is built starting `result code = ` at `:1876-1877`. In-tree precedent: `tests/spirv/direct-spirv-emit.slang.expected`.

Relevant when a fix converts a **segfault** into a diagnostic: the `diag=` test proves the message, only the `.expected` test proves it stopped crashing.

## 4. Reviewer-side lesson

I read both deciding sites (`:2187-2190` and `:2132`) correctly and then **asserted the outcome instead of running it** — getting the polarity backwards and overstating severity on my own top-billed finding, with the binary and worktree available. Reading the code that determines an outcome raises confidence in the *mechanism*, not in the *outcome*. When a claim is "does this pass / fire / what rc", the run is the evidence; a two-line `slang-test` invocation settles it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785987659514-a-gitignored-expected-file-makes-slang-test-fail-0.md`_
