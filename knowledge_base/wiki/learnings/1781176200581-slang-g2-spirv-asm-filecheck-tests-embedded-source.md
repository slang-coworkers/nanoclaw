---
title: "slang -g2 spirv-asm FileCheck tests: embedded-source self-match trap + local env gotchas"
type: learning
topic: slang-compiler
source: learnings/1781176200581-slang-g2-spirv-asm-filecheck-tests-embedded-source.md
---

# slang -g2 spirv-asm FileCheck tests: embedded-source self-match trap + local env gotchas

When writing or running SPIR-V debug-info FileCheck tests for shader-slang/slang, three non-obvious things bite (learned fixing #11550, PR #11555):

**1. `-g2` embeds the FULL source — including the test's own `//CHECK` comment lines — as a DebugSource `%1 = OpString "<source>"`.** So a `CHECK-NOT: <pattern>` whose pattern text appears in any directive line will self-match the embedded copy and FALSELY FAIL even when the code is correct. Two immunity tricks:
   - The embed ESCAPES quotes (`OpString \"Pair.$init\"`), so a pattern with REAL quotes (`CHECK-NOT: OpString "Pair.$init"`) matches only the genuine record, never the embedded copy. (Empirical: `grep 'OpString "X"'` returns 0 on output that contains the escaped embedded `\"X\"`.)
   - `%uint_[[#@LINE-1]]` resolves to a line NUMBER that is absent from the embedded literal text `[[#@LINE-1]]`, so resolved `DebugLine ... %uint_NN` patterns don't self-match. Use `@LINE`-relative, never literal `%uint_<n>`, in a `CHECK-NOT` for a source line.
   - Do NOT write a literal `CHECK-NOT: DebugFunctionDefinition %Foo` or `CHECK-NOT: DebugLine %uint_3` — the directive line embeds the pattern and self-matches. Anchor negatives on quoted names instead, or assert a positive proxy.
   - Source embedding is target-dependent: present under `-target spirv-asm`; `tests/spirv/debug-levels.slang` sidesteps it by using `-target spirv` and putting CHECK-NOTs only at g0/g1 levels (which emit less/no DebugSource text) while using positive `-DAG` checks at g2/g3.

**2. FileCheck is NOT available in the agent build env.** `slang-test <test>` prints "FileCheck is not available" and reports the test as `ignored` (0 passed, 1 ignored) for ANY `filecheck=` test — including existing ones. You cannot validate FileCheck tests locally. Verify the underlying behavior by running `slangc <repro> -target spirv-asm ... ` and grepping the asm, and rely on CI to run the FileCheck matcher.

**3. `extras/formatting.sh` requires clang-format 17.x (it REJECTS 18 as "too new").** Neither is preinstalled. Install with `pip install --break-system-packages clang-format==17.0.6` → binary lands in `/home/node/.local/bin/clang-format` (add to PATH). For a C++-only change you can skip the full script (which also wants gersemi/shfmt) and just run `clang-format --style=file <file>` — an empty diff means clean.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781176200581-slang-g2-spirv-asm-filecheck-tests-embedded-source.md`_
