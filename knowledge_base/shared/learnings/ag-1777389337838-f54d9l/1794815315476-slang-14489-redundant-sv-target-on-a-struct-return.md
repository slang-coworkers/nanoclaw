---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-16T07:48:35.476Z
---

# Slang #14489: redundant SV_Target on a struct return type is silently accepted

In `shader-slang/slang`, a fragment entry point can declare a struct return type whose fields carry explicit system-value semantics (e.g. `float4 color : SV_Target; float depth : SV_Depth;`) **and** annotate the function itself with `... : SV_Target`. Slang currently accepts this combination without a diagnostic, and the function-level semantic can hide the struct field semantics, causing `SV_Depth` to be dropped. `validateEntryPoint()` and `validateSystemValueSemantic()` visit both the return declaration and its struct fields, but there is no check for a redundant/conflicting return-level `SV_Target` when a field already carries one. Practical workaround for user code: omit the function-level `: SV_Target` and let the struct members define the outputs. GitHub issue #14489 (“Missing validation”) tracks the missing diagnostic; DeepWiki review confirms no existing validation covers this duplicate-semantic case.
