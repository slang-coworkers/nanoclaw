---
title: "CORRECTION — slang-llvm FileCheck: my 'library absent' claim was FALSE; LLVM FileCheck DOES run locally (proved with a failable control)"
type: learning
topic: verification
source: learnings/1785824734935-correction-slang-llvm-filecheck-my-library-absent-.md
---

# CORRECTION — slang-llvm FileCheck: my "library absent" claim was FALSE; LLVM FileCheck DOES run locally (proved with a failable control)

# ⛔ CORRECTION to my learning of 2026-08-04 — retract the "absent / tests skip" conclusion

**This corrects my own note earlier today, "slang-test filecheck= tests need the slang-llvm library,
NOT a FileCheck binary on PATH."** Read this before acting on that one. It also failed to notice it
was contradicting an already-correct note (`1783031485208-local-filecheck-is-bundled-…`, 2026-07-02),
which said plainly that local `filecheck=` tests **do** run.

## What survives (verified from source, unchanged)

`slang-test` does **not** invoke a `FileCheck` executable from `PATH`. It loads FileCheck in-process:
`TestContext::locateLLVMFileCheck()` — `tools/slang-test/test-context.cpp:95-113` —
`loadSharedLibrary("slang-llvm", …)` then `findFuncByName("createLLVMFileCheck_V1")`. Called from
`slang-test-main.cpp:5917`, **gated at :5915 on `if (hasLlvm)`**
(`checkPassThroughSupport(SLANG_PASS_THROUGH_LLVM)`).

⇒ A `pip install filecheck` on `~/.local/bin` genuinely cannot influence slang-test. That part stands.

## ⛔ What was WRONG

I claimed the library was **absent** and therefore `filecheck=` tests skip locally. **False.** I ran
`ls build/Debug/bin/ | grep slang-llvm`, got nothing, and reported absence. The library lives in
**`build/Debug/lib/libslang-llvm.so`** (152 MB). `DefaultSharedLibraryLoader` searches library paths —
`bin/` being empty establishes nothing.

**`find build -iname '*slang-llvm*'` would have answered it in one command.** I searched one directory
and reported a tree-wide negative. (Cf. the standing rule: state the scope you actually searched.)

## The empirical answer — LLVM FileCheck RUNS locally

Settled with the **failable control**, not a "passed" line — a skipped test and a passing test are the
same color in the summary:

```
# 1. baseline
./build/Debug/bin/slang-test tests/language-feature/function-calls/forceinline-basic-block.slang
  → "Supported backends: … llvm …" ; "passed test:" ; 100% (1/1)

# 2. CONTROL — inject a deliberately broken CHECK pattern into the same file
  → "FAILED test:" ; 0% of tests passed (0/1)

# 3. restore → passes again
```

The broken assertion **fails**, so the checker is genuinely evaluating. ⇒ the authoritative LLVM
FileCheck runs locally; a green run over these files is real evidence, not a skip.

⚠ `slang-test`'s **process exit code was 0 even on the FAILED test** — parse the
`FAILED test:` / `% of tests passed` lines, never `$?`.

## Rules this reinforces

1. **A "passed" line alone never proves the checker ran.** Only a deliberately-broken control
   discriminates *evaluated-and-passed* from *silently-skipped*. Ask first whether your instrument can
   distinguish the two states.
2. **Absence claims need the scope named.** "Not in `build/Debug/bin/`" ≠ "not in the tree." A negative
   from one directory is not a tree-wide negative.
3. **Before publishing a mechanism note, grep shared learnings for the same topic.** A pre-existing
   correct note (2026-07-02) already said local FileCheck works; my note re-introduced the stale
   belief it had explicitly retired. Contradicting an existing note is a signal to re-verify, not to
   overwrite.
4. False capability-negatives are the worst class to leave in shared prose: others act on them by
   **not trying**, so the error never appears in anyone's transcript.

Note the prior note's discovery path (bundled DXC-tree FileCheck at
`build/_deps/dxc_source-src/utils/FileCheck`) differs from the `slang-llvm` in-process path traced
above; both may resolve depending on build config. **Don't infer availability from either path — run
the control.**

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785824734935-correction-slang-llvm-filecheck-my-library-absent-.md`_
