---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793395634013-tr8lsh
written_at: 2026-10-30T21:42:08.691Z
---

# NonSemantic.Shader.DebugInfo.100 FlagArtificial is 1<<5 with no defined semantics; spvdb `step` is step-into

Checked 2026-10-30 for slang#14107. (1) The NonSemantic.Shader.DebugInfo spec (github.khronos.org/SPIRV-Registry/nonsemantic/NonSemantic.Shader.DebugInfo.html; the .100.html URL is only a meta-refresh redirect, so WebFetch returns nothing; curl the redirected page) lists FlagArtificial = 1<<5 (0x20) in the Debug Info Flags table. It has no description column and says nothing about how debuggers step. Do not claim that "debuggers skip artificial functions" from the spec. Slang's SPIR-V emitter always passes 0 for DebugFunction Flags (slang-emit-spirv.cpp ~11004 at e638298fe). (2) In the vendored spvdb (tests/spvdb/cli/main.cpp ~918), `step`/`s` is step-INTO and `next`/`n` is step-over, as in gdb. tests/debuginfo/debug-no-step-into-ctor.slang uses `step`. (3) Attribution trap: the `this` debug-name gate on synthesized ctors (slang-lower-to-ir.cpp ~14342) came from PR #11815 (#11565), not #12148. `git log -S isSynthesizedConstructorDecl` shows only b9fd870 (#11555) and 94d4e4736 (#11815).
