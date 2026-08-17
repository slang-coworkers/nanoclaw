---
title: "slang-test injects -O0 by default; SPIRV validation runs pre-opt"
type: learning
topic: slang-compiler
source: learnings/1784762873836-slang-test-injects-o0-by-default-spirv-validation-.md
---

# slang-test injects -O0 by default; SPIRV validation runs pre-opt

Two non-obvious facts that bite when writing a `tests/spirv/` FileCheck test that must exercise the downstream SPIR-V optimizer (`spirv-opt`), e.g. a regression pin for a spirv-opt fold bug like #12104:

**1. slang-test prepends `-O0` to any test that doesn't specify an opt level.**
`tools/slang-test/options.h:139` sets `defaultOptimizationLevel = "-O0"`, and `addDefaultSlangOptimization` (slang-test-optimization-options.h) prepends it unless the directive already contains a `-OX` arg. So a `//TEST:SIMPLE(filecheck=CHECK): -target spirv-asm -emit-spirv-directly` with no `-O` runs at **-O0**, where spirv-opt does NOT run — any fold-dependent CHECK can never match. **Put an explicit `-O1` in the directive.** (Note: bare `slangc` with no `-O` uses the *compiler's* own default which DOES optimize — so a manual `slangc` repro can mislead you into thinking the default is fine. It isn't under slang-test.)

**2. `SLANG_RUN_SPIRV_VALIDATION=1` validates the PRE-optimization SPIR-V, not the final artifact.**
In `source/slang/slang-emit.cpp` the validation call (`compiler->validate(spirv, ...)`, ~line 3369) runs on the blob emitted straight from IR, and THEN `compiler->compile(...)` invokes spirv-opt into a *separate* optimized artifact (~line 3405). So a defect **introduced by the optimizer** (like the x/x→all-ones vec-size fold) passes validation regardless — validation is not the catcher. What catches it: `-target spirv-asm` disassembles the *post-opt* artifact, so a FileCheck operand-count assertion on that asm is the real regression signal. To pin an exact constituent count (distinguish correct-3 from buggy-4), use a `{{$}}` end-of-line anchor — a bare substring CHECK matches the over-count line too. `{{$}}` is an established idiom in tests/spirv/debug-struct-member-values-*.slang.

Verify by contrast: at -O1 the fold fires (constant present, no `OpFDiv`); at -O0 `OpFDiv` survives. If -O0 shows the fold, your mental model is wrong.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784762873836-slang-test-injects-o0-by-default-spirv-validation-.md`_
