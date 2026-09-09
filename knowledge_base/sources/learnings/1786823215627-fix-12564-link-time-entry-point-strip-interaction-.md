---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786817452592-9bzqot
written_at: 2026-08-15T19:46:55.627Z
---

# Fix #12564 link-time entry-point strip: interaction with unexportNonEmbeddableIR SPIRV path

Reviewing the #12564 fix (source/slang/slang-ir-link.cpp end of linkIR: strip IREntryPointDecoration from any global IRFunc not in the selected `irEntryPoints`).

Key facts verified against source:
- `unexportNonEmbeddableIR` (slang-emit.cpp:707, gated at 2728 on EmbedDownstreamIR, runs 2730) strips IRPublicDecoration/IRDownstreamModuleExportDecoration from SPIRV funcs carrying IREntryPointDecoration (line 734). After the fix strips the decoration earlier at link time, this branch no longer fires for de-selected functions.
- `collectMetadata` (slang-ir-metadata.cpp:300-306) keys `m_exportedFunctionMangledNames` on IRDownstreamModuleExportDecoration+IRExportDecoration, NOT on IREntryPointDecoration. `collectMetadataFromInst` (204-208) gates on IRLayoutDecoration. So the fix does NOT change which functions are reported exported, nor binding metadata (a non-selected imported func has no param layout anyway).
- Normal EmbedDownstreamIR precompile (Module::precompileForTarget, slang-compiler-tu.cpp:120-152) selects ALL of the module's entry points (0..entryPointCount from getEntryPoints()); a [shader] func of the compiled module IS selected → fix preserves its decoration → unexportNonEmbeddableIR still sees it. No change for the ordinary precompile.
- EDGE CASE (found by codex, verified): a `.slang-module` passed POSITIONALLY (`slangc foo.slang-module -embed-downstream-ir -target spirv`) has its module entry-point list CLEARED (_addLibraryReference, end-to-end-request.cpp:1581-1583, addReferencedModule includeEntryPoint=false at options.cpp:1843). The embed loop (end-to-end-request.cpp:238) still calls precompileForTarget on that TU with an EMPTY entry-point list, so a [shader]+export func in it has zero selected entry points → the fix strips its IREntryPointDecoration → unexportNonEmbeddableIR no longer strips the export → it now emits as a SPIRV linkage Export (emit-spirv.cpp:6792) and is recorded in metadata. This is a real output/metadata change but arguably MORE correct (an unselected func is not an entry point). NOT covered by any existing test, so no existing test regresses. Obscure workflow (re-precompiling an already-embedded module).

Identity check: selectedEntryPoints holds the specialized clone returned by specializeIRForEntryPoint (same IRFunc instance in state->irModule the export cloning reuses via the clone map), so the contains() comparison correctly matches the instance unexportNonEmbeddableIR/collectMetadata iterate.

Lesson: codex's exception partly refuted my universal "all [shader] funcs are always selected" claim — the positional-.slang-module path clears entry points. Verify each link of a critique's chain against source before accepting OR dismissing; here the chain was mechanically sound but the practical severity is low (no test coverage, obscure invocation, behavior arguably correct).
