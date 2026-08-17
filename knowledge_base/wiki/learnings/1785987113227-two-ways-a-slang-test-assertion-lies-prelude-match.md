---
title: "Two ways a Slang test assertion lies: prelude-matched names, and exit codes no harness checks"
type: learning
topic: slang-compiler
source: learnings/1785987113227-two-ways-a-slang-test-assertion-lies-prelude-match.md
---

# Two ways a Slang test assertion lies: prelude-matched names, and exit codes no harness checks

Both found by peer review on slang#12367 (2026-08-06) *after* the test suite was green, and both
produce an assertion that reads strong and cannot fail.

## 1. On a target that emits a prelude verbatim, any name the prelude defines is unusable

I wrote, to prove `[DllImport]`'s function pointer still reaches host C++ output:

```
//TEST:SIMPLE(filecheck=CHECK): -target host-cpp -entry main -stage compute
//CHECK: Slang_FuncType
```

`host-cpp` is `ArtifactStyle::Host` ⇒ `isHeterogeneousTarget` ⇒ `slang-emit.cpp:2942` emits
`get_slang_cpp_host_prelude()` **verbatim** — and that prelude *defines* the name at
`prelude/slang-cpp-host-prelude.h:63`. So the check matched the prelude, not my module body, and
would pass with the pointer entirely gone.

**Measured, with a control I should have run first:** a shader with **no** `[DllImport]` at all emits
`Slang_FuncType` **once** (the prelude's `using` declaration). The `[DllImport]` build has **three**
occurrences — that line plus `Slang_FuncType<int32_t,int32_t> _S1 = nullptr;` and a bit-cast, which
are the body.

Fix: anchor on a *declaration* that only the body produces —
`//CHECK: Slang_FuncType<{{.*}}> {{.*}}= nullptr`.

⭐ **Prove it both ways.** Against that same no-`[DllImport]` control: new anchor **fails 0/1**, old
bare name **passes 1/1**. Proving the *old* form dead by feeding it output it should reject is the
complement of proving a `CHECK-NOT` live by negating it — and it converts "this assertion is
vacuous" from a code-reading into a measurement.

**General rule:** before asserting a symbol appears in emitted output, check whether the target's
prelude already contains it. `grep <symbol> prelude/*.h` first; if the prelude has it, the bare name
is a dud on every target that emits that prelude.

## 2. Neither `diag=` nor `filecheck=` asserts the compiler's exit code

If your fix converts a **crash** into a diagnostic, the obvious test cannot express that:

- **`DIAGNOSTIC_TEST(diag=…)`** — `_diagnosticAnnotationTest` (`tools/slang-test/slang-test-main.cpp:840`)
  takes `(context, input, diagPrefix, outputToCheck)`, i.e. **no result code**, and extracts only the
  `standard error = {…}` block, discarding the `result code = X` line that precedes it. So the test
  passes if the binary emits the diagnostic *and then* segfaults.
- **`TEST:SIMPLE(filecheck=…)`** — also no. Probed `//CHECK: result code = 255` → **0/1**; the code
  isn't in the FileCheck stream.
- **`//TEST:SIMPLE:` with a `.expected` file** — yes. `:1876-1877` builds the comparison string
  starting `result code = `, so the recorded baseline pins it. Precedent:
  `tests/spirv/direct-spirv-emit.slang.expected` opens `result code = 0`.

Generate the baseline by running the test once and promoting the `.actual`:

```bash
./build/Debug/bin/slang-test tests/path/new.slang     # writes new.slang.actual
cp tests/path/new.slang.actual tests/path/new.slang.expected
```

⚠ `.actual` files are gitignored (`.gitignore:38`) — harness scratch, never commit them.

**The unifying point:** pick the harness by *which property you need pinned*, not by which is
idiomatic for the directory. A `diag=` test pins message text and (in exhaustive mode) the count; a
`.expected` test pins the result code; real FileCheck pins emitted-text absence. Asserting the wrong
property is how a green suite coexists with an unpinned fix.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785987113227-two-ways-a-slang-test-assertion-lies-prelude-match.md`_
