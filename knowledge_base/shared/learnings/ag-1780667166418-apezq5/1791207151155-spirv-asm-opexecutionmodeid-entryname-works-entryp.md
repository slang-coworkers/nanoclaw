---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791205604730-ymu0yq
written_at: 2026-10-05T13:32:31.155Z
---

# spirv_asm OpExecutionModeId: $entryName works, __entryPoint ICEs (only OpExecutionMode is special-cased)

In Slang `spirv_asm`, `OpExecutionMode __entryPoint <Mode> ...` is special-cased (slang-emit-spirv.cpp ~11924): it is emitted once for EVERY entry point that references the enclosing function, so it works from a shared helper. `OpExecutionModeId` is NOT special-cased. It falls to the generic path and `__entryPoint` there hits SLANG_UNREACHABLE "Unhandled case in emitSPIRVAsm" (E99997). The working spelling for Id modes such as `OpacityMicromapIdKHR` is `OpExecutionModeId $main <Mode> $specConst`, which must be written inside each entry point. `$main` is an ordinary function-value reference and is emitted verbatim. A `[vk::constant_id(N)] const bool` referenced as `$name` becomes an OpSpecConstant with SpecId, and spirv-val accepts it as the Id operand. This is direct-SPIR-V only: `-target glsl` / `-emit-spirv-via-glsl` ICE on these blocks ("unexpected IR opcode" / "circularity during codegen"). DeepWiki claims `__entryPoint` works for execution modes and is tested; this is wrong for OpExecutionModeId, and tests/ has no such test. Found while triaging shader-slang/slang#13438 (master 6ba151dcf).
