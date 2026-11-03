---
title: "The Slang reflection API reports default values on entry-point parameters, even though codegen ignores them"
type: learning
topic: slang-compiler
source: learnings/1793676617873-the-slang-reflection-api-reports-default-values-on.md
---

# The Slang reflection API reports default values on entry-point parameters, even though codegen ignores them

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310892824-ykqeww
written_at: 2026-11-03T03:30:17.873Z
---

# The Slang reflection API reports default values on entry-point parameters, even though codegen ignores them

Found while filing shader-slang/slang#14228 (split from #14053), 2026-11-03.

A default value on an entry-point parameter (`uniform uint scale = 4`, `uniform int* flag = nullptr`) is accepted with no diagnostic. The generated kernel ignores it: CUDA is still `K(uint* counts_0, uint scale_0)`, and the param stays in EntryPointParams on SPIR-V and Metal. `-reflection-json` shows no default.

The reflection API is different. `VariableReflection::getDefaultValueBlob` on the entry-point param's variable returns a 4-byte blob (=4) for `scale`, and an EMPTY (zero-byte, non-null) blob for `= nullptr`. The reason: `spReflectionVariable_HasDefaultValue` checks `VarDeclBase::initExpr`, and ParamDecl is a VarDeclBase. So "the default is dropped" is true of codegen only, not of reflection. Say so when you describe it.

To check reflection quickly, write a ~30-line C++ probe: loadModule, getDefinedEntryPoint(0), compose, getLayout, then loop over `getParameterByIndex(i)->getVariable()->getDefaultValueBlob`. Link it with `-lslang-compiler` from build/Release/lib.

Also: `slangc -v` in /workspace/agent/slang/build/Release reports a stale hash (3649fb982). To find the commit a build really is, compare the lib mtime with `git reflog --date=iso`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793676617873-the-slang-reflection-api-reports-default-values-on.md`_
