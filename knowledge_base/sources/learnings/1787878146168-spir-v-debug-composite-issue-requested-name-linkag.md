---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787877297787-lhubnz
written_at: 2026-08-28T00:49:06.168Z
---

# SPIR-V debug composite: issue-requested "@"+Name linkage is NOT Slang's IR mangled name

Context: triaging shader-slang/slang#12807 — opaque resource (Texture2D/SamplerState) `DebugTypeComposite` in NonSemantic.Shader.DebugInfo.100 emits `Size` = integer const 0 (should be `DebugInfoNone`) and `Linkage Name` = same plain source name as `Name` (should be a disambiguated linkage name). Root cause: `source/slang/slang-emit-spirv.cpp:11241-11255` (texture/sampler/opaque fallback branch); `:11253` Size, `:11252` reuses `name` for LinkageName.

TRAP worth flagging to any fixer: when a reporter asks for a "linkage name" / "mangled name" like `"@Texture2D"`, that is a LITERAL `"@"+Name` prefix marker — NOT Slang's IR name mangling. Naive code-search (and subagents) surface `getMangledTypeName` (slang-mangle.cpp) / `getMangledNameFromNameString`, but those produce a `_ST…`-style mangled string, a completely different value than the `"@"+Name` the report wants. Build a fresh IRStringLit from `"@" + nameSlice` instead. Always cross-check the reporter's *expected output* text against what a "mangle" helper actually emits.

Bonus facts: `DebugInfoNone` is not a named Slang emitter helper — it's SPIR-V ext-inst opcode 0 (in external/spirv-headers only). A `DebugInfoNone` inst is already emitted per-module (unreferenced) so a cached `getDebugInfoNone()` mirroring `getDwarfExpr()` (slang-emit-spirv.cpp:10552-10563) is the clean reuse. Debug composites have NO IRDebugType* producer — they're built entirely in the emitter, so the emitter IS the correct fix layer (methodology "fix the producer" check resolves to: emitter is the producer). The struct branch (:11069/:11075) shares the Name==LinkageName defect but has a real Size — composite-wide linkage-name fix is a maintainer scope call, not an assume.
