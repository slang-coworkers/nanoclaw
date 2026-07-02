---
title: "slang-test FileCheck runner parses CHECK: tokens in PROSE comments as live directives"
type: learning
topic: slang-compiler
source: learnings/1782908183110-slang-test-filecheck-runner-parses-check-tokens-in.md
---

# slang-test FileCheck runner parses CHECK: tokens in PROSE comments as live directives

**Trap:** A `//TEST:...(filecheck=CHECK):` test failing with `CHECK: expected string not found` on a line that is NOT a directive line (it's explanatory prose) — e.g. reported at `line 7:85` where line 7 is a comment sentence.

**Cause:** The FileCheck runner (LLVM FileCheck semantics, via slang-test's in-process `IFileCheck`) scans the **entire test file** for its prefix token `<PREFIX>[-SUFFIX]:` (case-sensitive, at a word boundary) — it does NOT care that the token sits inside a `//` comment, inside backticks, or in mid-sentence prose. So an explanatory comment that literally writes `` `CHECK: OpEntryPoint` `` or `` `//CHECK-NOT:` `` (common when documenting *why* the test uses the FileCheck runner) becomes a **live directive**. The line-7 example parsed pattern `OpEntryPoint` + trailing backtick, which never matches real disassembly → fail.

This is the counter-intuitive inverse of the DIAGNOSTIC_TEST rule: under `//DIAGNOSTIC_TEST(diag=CHECK):` a stray `//CHECK-NOT:` is INERT (that annotation parser only recognizes its own `//<prefix>:` lines); under the `filecheck=` runner the very same token is LIVE. A comment explaining the former can trip the latter.

**Fix:** never spell a live directive token (`CHECK:`, `CHECK-NOT:`, or your custom prefix like `RETONLY:`) in prose in a `filecheck=` test. Use an abstract placeholder — `//<prefix>:`, `//<prefix>-NOT:` — or drop the colon (`a CHECK-NOT line`). Note `FileCheck` (mixed-case) is safe: the default prefix is all-caps `CHECK`, matched case-sensitively, so "FileCheck"/"Check" never trip it.

**Verifying without a local FileCheck binary** (slang-test skips filecheck= tests as "ignored" when its `IFileCheck` module is absent — common in a plain debug build): emulate FileCheck's directive scan with `grep -nE 'CHECK(-[A-Z]+)?:' file` (and per custom prefix) to enumerate exactly what it would treat as directives — confirm only the intended ones remain — then confirm each matches real emission via a direct `slangc -target spirv-asm` probe (grep for the expected op + the negated diagnostic code). Two-pronged (emulation + real emission) is as good as running the runner for this class of bug.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782908183110-slang-test-filecheck-runner-parses-check-tokens-in.md`_
