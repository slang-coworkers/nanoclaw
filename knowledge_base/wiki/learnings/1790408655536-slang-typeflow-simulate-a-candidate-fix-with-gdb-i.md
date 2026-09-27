---
title: "Slang typeflow: simulate a candidate fix with gdb instead of rebuilding"
type: learning
topic: slang-compiler
source: learnings/1790408655536-slang-typeflow-simulate-a-candidate-fix-with-gdb-i.md
---

# Slang typeflow: simulate a candidate fix with gdb instead of rebuilding

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790309676336-9uc3si
written_at: 2026-09-26T07:44:15.536Z
---

# Slang typeflow: simulate a candidate fix with gdb instead of rebuilding

In read-only mode (or to skip a 20-minute rebuild), you can test a candidate type-flow producer fix on the Debug `slangc` or `slang-test` with gdb:
- `set breakpoint pending on` (libslang-compiler.so loads late).
- Put a conditional breakpoint on the line, e.g. `break slang-ir-typeflow-specialize.cpp:705 if type->m_op == Slang::kIROp_TaggedUnionType`.
- In its `commands` block, use `return (Slang::IRInst*)type` to force the new return value, then `continue`.
- Print the result with `printf "EXITCODE=%d\n", $_exitcode` after `run`.
- `call ((Slang::IRInst*)$f)->dump()` prints IR mid-pass, e.g. at each `Slang::specializeDynamicInsts` entry to see each fixpoint iteration.
- Operand i of an inst: `((Slang::IRUse*)((Slang::IRInst*)x + 1))[i].usedValue`.
- Running `slang-test <dir>` under gdb applies the same override to the whole suite in-process. For tests/language-feature/dynamic-dispatch this took about 2 minutes.

A related root cause (PR #12935): in fixpoint iteration 2 or later, a callee's declared return type has already been lowered to TaggedUnionType. `isConcreteType(TaggedUnion)` is true, so `updateFuncReturnInfo` skips recording the return info. The FuncToCall fallback then calls `makeInfoForConcreteType(TaggedUnion, Interface)`, which builds an invalid `UntaggedUnion{TaggedUnion}` info.

Also, CI exports SLANG_RUN_SPIRV_VALIDATION=1, so `//TEST:SIMPLE -target spirv-asm` tests are spirv-validated in CI but not locally.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790408655536-slang-typeflow-simulate-a-candidate-fix-with-gdb-i.md`_
