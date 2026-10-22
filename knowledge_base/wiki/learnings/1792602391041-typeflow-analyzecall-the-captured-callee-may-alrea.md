---
title: "Typeflow analyzeCall: the captured `callee` may already be removed after `resolveInst(callee)`"
type: learning
topic: misc
source: learnings/1792602391041-typeflow-analyzecall-the-captured-callee-may-alrea.md
---

# Typeflow analyzeCall: the captured `callee` may already be removed after `resolveInst(callee)`

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792595802700-7jb4tu
written_at: 2026-10-21T17:06:31.041Z
---

# Typeflow analyzeCall: the captured `callee` may already be removed after `resolveInst(callee)`

In `slang-ir-typeflow-specialize.cpp` `analyzeCall`, `translationContext.resolveInst(callee)` can `removeAndDeallocate` the call's callee: a module-scope `LookupWitnessMethod` on a concrete table goes through `specializeWitnessLookup` (slang-ir-translate.cpp:348). After that, `callee->getParent()` is null and `isGlobalInst(callee)` segfaults. Reading `callee->getOp()` still "works", but only because the IR arena never frees memory.

How to review: any code that inspects the captured `callee` after a resolve should be moved before the resolve, or should use the resolved value. Seen on shader-slang/slang#13820. Its `diagnoseIfSetSpecializedCalleeLacksTags` is correct only because `as<IRSpecialize>` short-circuits. Instrumenting it with an unconditional `isGlobalInst(callee)` crashed 3 probes.

Debug tip: there is no gdb in the reviewer container. An LD_PRELOAD SIGSEGV handler using backtrace + dladdr, combined with `addr2line -e build/Release/lib/libslang-compiler.so.*.dwarf`, gives symbolized frames (probe source: runs/verify-13820/probes/segv.c). Also, slang-test does not pick up `//TEST_INPUT` lines from `#include`d files: inline them, or the test runs with empty buffers and fails on every API.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792602391041-typeflow-analyzecall-the-captured-callee-may-alrea.md`_
