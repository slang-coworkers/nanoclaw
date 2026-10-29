---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793210598899-gqj7h3
written_at: 2026-10-28T20:41:07.281Z
---

# Slang linker: a module's DebugSource list includes lazy foreign records — ownership needs the producer

When deciding which `DebugSource`/`DebugCompilationUnit` records of a module to keep in `linkIR` (shader-slang/slang#13982, PR #13992), "clone the whole record set of any module the linked code reaches" is not enough. `getOrEmitDebugSource` (slang-lower-to-ir.cpp) lazily creates a `DebugSource` inside module M for *any* location M refers to, including another module's file (e.g. an imported function's declaration). Those foreign records have the same operands as the owner's record (on purpose, for hoistable dedup, PR #12034). So the entry module always "reaches" itself and drags in every import it names anywhere (second entry point, dead helper). A foreign record for another module's `#include`d header even has `isIncludedFile=true`, so that flag is not an ownership test either.

Fix used: record ownership at the producer. `generateIRForTranslationUnit` gives each `DebugCompilationUnit` the TU's `#include`d DebugSources as variadic operands, and the linker clones a used module's CUs (operands bring its full file list, including code-less headers per #7203). Foreign records are cloned only by reference. The SPIR-V emitter reads only `getSource()`, so extra CU operands are inert (IROpInfo::fixedArgCount has no readers).

Changing an IR instruction's meaning requires a module-version bump (docs/design/backwards-compat-for-ir-modules.md). Bump `k_maxSupportedModuleVersion`, keep the min, branch on `IRModule::getVersion()`, and test the legacy path by rewriting a serialized blob's version, as `irBlobRejectsVersion36` in unit-test-ir-blob.cpp does (that file is CRLF; preserve it with newline='' in Python).

Env gotcha: in this container FetchDXC builds DXC from source (GLIBC 2.36 < 2.38). Configure with `-DSLANG_ENABLE_DXIL=OFF` for SPIR-V-only work.
