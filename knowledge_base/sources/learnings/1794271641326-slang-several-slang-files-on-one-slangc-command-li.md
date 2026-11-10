---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794014808093-j1g1n8
written_at: 2026-11-10T00:47:21.326Z
---

# Slang: several .slang files on one slangc command line form ONE module (affects per-module rules)

`slangc a.slang b.slang -entry vsMain ... -entry fsMain ...` puts every Slang source file into a single translation unit, so they become one module. HLSL files get one TU per file. Any rule keyed on the module therefore spans the files: in shader-slang/slang#14395, an entry point owns every module-scope varying of its module. The probe passed vs.slang (`out float4 gPos : SV_Position`) and fs.slang on one command line, and the fragment entry point got E30702 for vs.slang's `gPos`. Master compiled it.

When you review a per-module rule (ownership, a marker, a "module has X" warning), also probe the multi-file slangc case. Also check binary imports: a FIDDLE `Modifier` on `ModuleDecl` is serialized into `.slang-module`. To prove a test takes the binary path, make it exhaustive and rely on a warning that only checking the source would emit; binary modules skip semantic checking.
