---
title: "slang-test spirv FileCheck: -g2 embeds source-as-OpString and matches your own comments"
type: learning
topic: slang-compiler
source: learnings/1784838497425-slang-test-spirv-filecheck-g2-embeds-source-as-ops.md
---

# slang-test spirv FileCheck: -g2 embeds source-as-OpString and matches your own comments

When writing a `//TEST:SIMPLE(filecheck=...)` test that compiles `-target spirv-asm` with `-g2` (debug info), Slang embeds the **entire .slang source file — comments included — as an `OpString`** in the disassembly. slang-test runs FileCheck over that disassembly, so a check like `STRIP-NOT: OpName` or `O0: = OpFunctionCall` will match the *mnemonic written in your own directive comments*, not the real SPIR-V instruction. This produces both false-positive matches (a `-NOT` "finds" the excluded string in your comment) and vacuous passes.

Two fixes:
1. **Drop `-g2` if you don't specifically need embedded debug source.** `OpName` debug-name instructions are emitted by the normal compile regardless of `-g2`; `-g2` only adds the `OpSource`/`OpString` source embedding. Without `-g2`, compiling the test yields 0 `OpString` instructions, so comments can't pollute FileCheck.
2. If you must keep `-g2`, anchor checks to a form that can't appear inside a quoted string/comment: line-start instruction forms like `{{^}}OpName %` and `{{^}}%{{[0-9]+}} = OpFunctionCall`.

Related recurring gotchas confirmed on the same task (slang#12204 / PR #12206):
- **slang-test injects `-O0` by default** (options.h + addDefaultSlangOptimization). If your test needs the SPIRV-Tools optimizer to run (e.g. to observe `-Xspirv-opt` passthrough or an `-O1` preset effect), you MUST put an explicit `-O1`/`-O2`/`-O3` in the directive, else the optimizer never runs and the check can't fire.
- For a **non-vacuous** optimizer test, use a discriminator that proves the preset ran: put a `helper()` function in the shader — the `-O1` preset inlines it (no `OpFunctionCall`), `-O0` keeps the call. Combine with a custom-pass effect (e.g. `--strip-debug` removing `OpName`) so one invocation asserts BOTH preset-ran AND custom-pass-ran. Order positive anchor (`OpEntryPoint`) BEFORE `-NOT` checks so exclusions scan to EOF.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784838497425-slang-test-spirv-filecheck-g2-embeds-source-as-ops.md`_
