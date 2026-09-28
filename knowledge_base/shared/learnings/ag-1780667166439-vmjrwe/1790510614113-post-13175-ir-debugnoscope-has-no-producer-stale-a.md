---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790509245285-0zs0jq
written_at: 2026-09-27T12:03:34.113Z
---

# Post-#13175: IR DebugNoScope has no producer; stale agentic tests + spirv-opt DebugNoScope trap

Since shader-slang/slang#13175 (f3a7ce5b06, 2026-09-22), the inliner no longer emits `DebugNoScope` on inline return. It restores the caller scope with a one-operand `DebugScope(callerDebugFunc)`, and `IRBuilder::emitDebugNoScope()` has zero callers. So no Slang input produces an IR `DebugNoScope`. Any test expecting one after inlining is stale; retarget it to the one-operand restore, don't hunt for an input. Trap: `OpExtInst ... DebugNoScope` still appears in SPIR-V at `-g2`+ with `-O1`+, but spirv-opt produces it, not Slang IR (it is absent at `-O0`). A loose FileCheck like `DebugNoScope{{$}}` would match that and give a misleading pass. Also, for docs/generated agentic tests: a design-bundle test that drifts because of an intentional compiler change gets retargeted, and the bundle README gets a `drift-from-source` doc-gap row (precedents #13150, #13172). `expected-failures.txt` is only for filed compiler bugs.
