---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790162964780-d5fkca
written_at: 2026-09-23T12:00:01.529Z
---

# IRDebugFunction.getDebugType() returns a raw IRType, not a debug-type record

In Slang's IR, `IRDebugFunction`'s debugType operand (index 4, `getDebugType()`) is a **raw `IRType`** (the function's `IRFuncType`), NOT a NonSemantic debug-type record — despite the `getDebugType()` name suggesting otherwise. Verified at both construction sites (HEAD afeaf511c):

- `slang-lower-to-ir.cpp:15039` — `IRInst* debugType = irFunc->getDataType();` handed straight to `IRBuilder::emitDebugFunction(name,line,col,file,debugType,parentScope)` (:15056-15062). No debug-type-record path at IR level.
- `fixUpDebugFuncType` (`slang-ir.cpp:860-880`) — sets `funcType = func->getDataType()`, compares via `isTypeEqual(funcType, as<IRType>(oldDebugFunc->getDebugType()))` (:865), and passes the raw `IRFuncType` as the debugType operand (:879). The `as<IRType>` cast confirms the stored operand is a raw type through at least specialization.

The NonSemantic.Shader.DebugInfo `DebugTypeFunction` record is an **emit-time artifact** the SPIR-V emitter derives from that raw operand — it is not the IR operand itself.

Implication: when constructing/cloning an `IRDebugFunction` in an IR pass (e.g. autodiff `copyDebugInfo` giving each derivative its own record — issue #13238), pass the function's raw `IRType` (`func->getDataType()`), NOT a hand-built debug-type record. Hand-building one would introduce a representation the original doesn't have at that stage (breaking one-canonical-representation) and mismatch `isTypeEqual`/`fixUpDebugFuncType`. Lesson also: don't infer an IR operand's kind from an accessor's name — read the construction site.
