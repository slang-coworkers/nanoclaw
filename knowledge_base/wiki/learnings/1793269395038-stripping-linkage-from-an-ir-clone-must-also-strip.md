---
title: "Stripping linkage from an IR clone must also strip precompiled-module decorations (DownstreamModuleExport, AvailableInDownstreamIR)"
type: learning
topic: slang-compiler
source: learnings/1793269395038-stripping-linkage-from-an-ir-clone-must-also-strip.md
---

# Stripping linkage from an IR clone must also strip precompiled-module decorations (DownstreamModuleExport, AvailableInDownstreamIR)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793263707074-ar32jd
written_at: 2026-10-29T10:23:15.038Z
---

# Stripping linkage from an IR clone must also strip precompiled-module decorations (DownstreamModuleExport, AvailableInDownstreamIR)

Observed on slang#14004 / PR #14008, 2026-10-29.

**What crashes.** `removeLinkageDecorations` (slang-ir-util.cpp) removed `ExportDecoration` but left two decorations that depend on it.
- `DownstreamModuleExportDecoration`: the SPIR-V emitter (slang-emit-spirv.cpp ~6930) and `collectMetadata` both call `findDecoration<IRExportDecoration>()->getMangledName()`. In the precompile producer (`-embed-downstream-ir`), a clone with this decoration but no `ExportDecoration` segfaults.
- `AvailableInDownstreamIRDecoration`: `removeAvailableInDownstreamModuleDecorations` (slang-ir-redundancy-removal.cpp) runs AFTER `legalizeIRForSPIRV`. It removes the body of every function with this decoration and adds `DownstreamModuleImport`. A clone without an export name therefore crashes in the CONSUMER compile.

**Keep-alive pitfall in address-space specialization.** Keeping every `[KeepAlive]` original alive in `specializeAddressSpace` made Metal crash on `export` functions with inout params: the #11981 "Unknown addressspace" error, on code that compiles on master. Only originals carrying `DownstreamModuleExportDecoration` need to stay, and that decoration exists only for DXIL/SPIR-V.

**Testing precompiled modules.**
- When linking against a precompiled SPIR-V module fails (for example "Too many external references" or "Unresolved external reference"), slangc prints a SPIRV-TOOLS message, exits 0, and writes no output. Use `TEST:SIMPLE(filecheck)` on `-target spirv-asm` output, not `TEST:COMPILE`.
- If the library module has its own entry point, both modules need `-fvk-use-entrypoint-name`. Otherwise the link fails with "entry point main already defined".

**Cheap regression check.** An A/B corpus run caught zero plain-output changes and confirmed the fix:
- Compile every `tests/**/*.slang` with a saved master binary and with the fix, for `-target metal`/`wgsl`, with and without `-obfuscate` (xargs -P 20, about 15 min on 64 cores).
- `cmp` the outputs and compare exit codes.
- Only about 60% of the files compile standalone, so report that denominator.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793269395038-stripping-linkage-from-an-ir-clone-must-also-strip.md`_
