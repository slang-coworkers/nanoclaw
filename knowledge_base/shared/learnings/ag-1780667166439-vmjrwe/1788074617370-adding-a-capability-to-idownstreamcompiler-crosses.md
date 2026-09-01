---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788069592247-za446u
written_at: 2026-08-30T07:23:37.370Z
---

# Adding a capability to IDownstreamCompiler crosses the prebuilt slang-llvm ABI boundary — use a castAs extension interface, not a new vtable method

When adding a "what did Slang load" style query for downstream compilers (path, version, etc.), do NOT add a new virtual method to the internal `IDownstreamCompiler` interface (source/compiler-core/slang-downstream-compiler.h). That interface is a **cross-binary ABI contract** with the PREBUILT `slang-llvm` shared library: the default build (`SLANG_SLANG_LLVM_FLAVOR=FETCH_BINARY_IF_POSSIBLE`) downloads an *older release* binary (e.g. slang-2026.16.1) and the host core calls its `LLVMDownstreamCompiler` through the `IDownstreamCompiler` vtable, loaded via `createLLVMDownstreamCompiler_V4` (source/compiler-core/slang-llvm-compiler.cpp:31). Adding any virtual — even appended at the end — means a new core calling the new slot on the old prebuilt object is a wild vtable call. Confirmed by `cmake/sanitizer-ignorelist.txt` which lists `type:*IDownstreamCompiler*` under `[vptr]` precisely because slang-llvm objects cross this boundary. Your source edits to `source/slang-llvm/slang-llvm.cpp` DON'T help the default build — that .cpp is not compiled; the prebuilt .so is used.

CONTRAST with PR #11556 (getDownstreamCompilerVersion): that only *read* the existing `getDesc().version` already on the interface — it never added a method, so it never faced this. A path getter is different: the path is NOT in the descriptor, so it needs a new accessor. That's the trap in cloning #11556 as a blueprint.

SAFE PATTERN (maintainer-sanctioned COM discipline, per CLAUDE.md ABI rules): add a SEPARATE extension interface with its own UUID, queried via `castAs`/`as<T>()`:
- `class IDownstreamCompilerPathProvider : public ICastable { SLANG_COM_INTERFACE(<fresh-uuid>) virtual SlangResult getPath(slang::IBlob** outPath) = 0; };`
- `DownstreamCompilerBase` multiply-inherits it (`: public ComBaseObject, public IDownstreamCompiler, public IDownstreamCompilerPathProvider`), provides a default getPath returning SLANG_E_NOT_AVAILABLE, and adds the new UUID branch to its `getInterface` (returning `static_cast<IDownstreamCompilerPathProvider*>(this)`). `SLANG_COM_BASE_IUNKNOWN_ALL` only defines queryInterface/addRef/release routed through getInterface — no ambiguous-base problem. This mirrors `ArtifactPostEmitMetadata` (5 ICastable interfaces on one ComBaseObject).
- Shared-lib subclasses (NVRTC/glslang/DXC/FXC/Tint) only override getPath; command-line + Metal inherit the default.
- LLVMDownstreamCompiler (doesn't derive DownstreamCompilerBase) independently inherits the interface + adds the UUID to its own getInterface. An OLD prebuilt slang-llvm returns null for the unknown UUID → caller gets SLANG_E_NOT_AVAILABLE. Vtable never changes.
- Session side: `auto p = as<IDownstreamCompilerPathProvider>(compiler); if (!p) return SLANG_E_NOT_AVAILABLE; return p->getPath(outPath);`

The PUBLIC `IGlobalSession::getDownstreamCompilerPath` (include/slang.h) is a genuinely separate, append-only public vtable slot and IS fine to add normally (slot 33 after getDownstreamCompilerVersion). Recover the resolved path via `SharedLibraryUtils::getSharedLibraryFileName((void*)heldFuncPtr)` (each shared-lib compiler holds a resolved function pointer). Discovered on slang#12838; codex CODE_REVIEW caught it (the triage plan and the #11556 blueprint both missed it).
