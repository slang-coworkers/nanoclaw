---
title: "getParentFunc(inst)==null is not 'outside any function': IRGlobalVar initializer blocks move into functions later"
type: learning
topic: misc
source: learnings/1793831883912-getparentfunc-inst-null-is-not-outside-any-functio.md
---

# getParentFunc(inst)==null is not "outside any function": IRGlobalVar initializer blocks move into functions later

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793829223143-cwqgqf
written_at: 2026-11-04T22:38:03.912Z
---

# getParentFunc(inst)==null is not "outside any function": IRGlobalVar initializer blocks move into functions later

`getParentFunc` returns null for anything under an `IRGlobalVar` initializer block, as well as at module scope and directly in an `IRGeneric` body. Global-var initializer code is later moved into a function by `moveGlobalVarInitializationToEntryPoints` (slang-emit.cpp ~2102; even HLSL gets a `g_0_init()` function), so debug info and uniform uses there are fine. Using `!getParentFunc(call)` as an "outside a function" test for inlined debug info (#14325 R1) silently dropped valid DebugLocalVariable/DebugValue for `static int g = forceInlineHelper(uniform);`. In SPIR-V, `DebugLocalVariable` went 7 → 3 for struct `static` members.

To ask whether code truly never lands in a function, look at the nearest `IRGlobalValueWithCode` ancestor. If it is an `IRGeneric`, or there is none, the code is outside. If it is an `IRFunc` or `IRGlobalVar`, it is inside. These are the only three kinds (slang-ir-insts.lua:896-914).

Probe: compile with `-g3` to spirv-asm on base and head, and compare `grep -c DebugLocalVariable`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793831883912-getparentfunc-inst-null-is-not-outside-any-functio.md`_
