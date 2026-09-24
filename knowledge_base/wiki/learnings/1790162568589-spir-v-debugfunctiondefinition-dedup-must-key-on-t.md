---
title: "SPIR-V DebugFunctionDefinition dedup must key on the DebugFunction record, not the OpFunction body"
type: learning
topic: slang-compiler
source: learnings/1790162568589-spir-v-debugfunctiondefinition-dedup-must-key-on-t.md
---

# SPIR-V DebugFunctionDefinition dedup must key on the DebugFunction record, not the OpFunction body

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790151605588-u44k0c
written_at: 2026-09-23T11:22:48.589Z
---

# SPIR-V DebugFunctionDefinition dedup must key on the DebugFunction record, not the OpFunction body

When emitting SPIR-V NonSemantic `DebugFunctionDefinition` in `slang-emit-spirv.cpp`, a `DebugFunction` record binds to **exactly one** definition (the NonSemantic invariant; spirv-tools' `val_ext_inst_debug_test.cpp` treats multiple-per-record as invalid). If you add a "definition already emitted" dedup set to fix the missing-definition case (shader-slang/slang#13235), **key it on the `DebugFunction` record (`debugFuncInfo`), not the `spvFunc`/OpFunction body.**

Why it matters: reverse- and forward-mode autodiff's `copyDebugInfo` (`slang-ir-autodiff.cpp:~1355`) clones the `IRDebugFuncDecoration` onto every generated function (`s_apply_`/`s_bwdProp_`/`s_remat_`, `slang-ir-autodiff-rev.cpp:~409-411`). The decoration operand is a **module-global `IRDebugFunction`**, and `cloneDecoration`/`findCloneForOperand` (`slang-ir-clone.cpp`) leaves global operands unchanged — so several distinct emitted `OpFunction`s **share one `IRDebugFunction` record**. Keying the dedup on the body then emits one definition per shared body → N definitions bound to one record (invalid). Keying on the record emits ≤1 and upholds the invariant. Verified: a loop-based reverse-autodiff `-g2 -O0` case (differentiated fn inlining a `[ForceInline]` callee + a local after the call) produced 2 `DebugFunctionDefinition`s per record with body-keying, 1 with record-keying. `spirv-val` does NOT catch this (NonSemantic debug info isn't validated), so it's silent.

The shared `IRDebugFunction` is itself a separate, pre-existing autodiff **producer** representation bug (generated funcs all claim the target's debug name/line; extra shared bodies silently get no definition). Principled root fix is producer-side: each generated func should get its own `IRDebugFunction` in `copyDebugInfo` (would also make body-vs-record keying equivalent). Left as a follow-up, out of scope for the emit fix.

Minor tooling trap found alongside: `awk 'length>100'` for column checks counts **bytes**; an em-dash `—` is 3 bytes / 1 char, so it false-flags ≤100-column comment lines as over. `clang-format` (display columns) is the authority — if it reports NO CHANGES, the line is within the limit.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790162568589-spir-v-debugfunctiondefinition-dedup-must-key-on-t.md`_
