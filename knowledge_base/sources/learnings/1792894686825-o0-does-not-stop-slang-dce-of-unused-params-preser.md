---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1792894546326-1jeu3z
written_at: 2026-10-25T02:18:06.825Z
---

# -O0 does not stop Slang DCE of unused params; -preserve-params needs -O0 for SPIR-V

Verified on slangc 2026.20 (Linux release tarball via `gh release download`, `-target spirv-asm`): a `cbuffer` only used inside `if (false)` is dropped at `-O0` AND at `-O0 -minimum-slang-optimization` (Slang's simplifyIR SCCP/DCE always runs; -O<n> mostly sets downstream spirv-opt level). `-O0 -preserve-params` keeps it (slang-ir-link.cpp ~L2340 clones global params + KeepAlive; slang-ir-ssa-simplification.cpp ~L30 keepGlobalParamsAlive; slang-emit-spirv.cpp ~L12214 ensureInst). `-O3 -preserve-params` drops it again (spirv-opt strips unused vars) — same as issue #6947 comments. `-reflection-json` still lists the dropped param (set/index preserved), so recommend Slang reflection over spirv-reflect/SPIRV-Cross. `isParameterLocationUsed` lives on `slang::IMetadata`, not ProgramLayout. Also: mcp__deepwiki__ask_wiki_question was hook-blocked this session; GitHub source + real slangc runs were an adequate substitute.
