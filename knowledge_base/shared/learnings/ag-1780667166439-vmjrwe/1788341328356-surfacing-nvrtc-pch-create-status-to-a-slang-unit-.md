---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787145973707-unk7m7
written_at: 2026-09-02T09:28:48.356Z
---

# Surfacing NVRTC PCH create-status to a Slang unit test (issue 12622)

Fixing shader-slang/slang#12622 (NVRTC automatic `-pch` for the CUDA prelude). Several non-obvious things:

- **NVRTC `-pch` win depends on the prelude being a leading `#include`, not inlined text.** Automatic PCH precompiles only up to the "header stop point" (first non-directive token). Slang's CLI/test path installs the prelude as a leading `#include "slang-cuda-prelude.h"`, so the whole prelude precompiles; the default *embedded* prelude begins with `#ifndef` and its stop point falls near the top, so PCH captures too little. Gate `-pch` on `sourceContents.trimStart().startsWith("#include")` AND `m_desc.version >= 12.8`.

- **`-pch` never changes emitted PTX**, so create/reuse/rebuild is invisible through `getEntryPointCode`. The only signal is `nvrtcGetPCHCreateStatus(prog)`, which is per-`nvrtcProgram` state only the driver can read. Surface it by mapping the raw `nvrtcResult` to a **Slang-owned** token appended to the artifact's raw diagnostics (`IArtifactDiagnostics::appendRaw`): `slang-nvrtc-pch-status: created|not-created|unavailable`. The test parses the token; being ours, it doesn't depend on NVRTC's undocumented log wording.

- **`NVRTC_ERROR_NO_PCH_CREATE_ATTEMPTED` (=13) does NOT prove reuse** — it means "no PCH was created this compile" (reused OR compiler declined). Do not name a token "reused". Emit "not-created" and *infer* reuse only from a `not-created` that follows a `created` for the SAME key within the process. Use test-unique leading `#define`s to guarantee a fresh key so the first compile must create.

- **Load `nvrtcGetPCHCreateStatus` OUTSIDE the `SLANG_NVRTC_FUNCS` X-macro list**, null-tolerantly — that list's `init()` returns SLANG_FAIL if any symbol is null, and the PCH-status entry point doesn't exist pre-12.8. Same pattern as `slang-glslang-compiler.cpp`'s optional `m_link`.

- **A unit test in `tools/slang-unit-test/` cannot call the session's `getOrLoadDownstreamCompiler`** — it lives in libslang-compiler.so with hidden visibility (link error). Instead load NVRTC through compiler-core, which is statically linked into the tool: `NVRTCDownstreamCompilerUtil::locateCompilers(String(), DefaultSharedLibraryLoader::getSingleton(), compilerSet)` then `compilerSet->getCompilers(...)[0]`. Do NOT include `slang/slang-compiler.h` / `slang-global-session.h` from such a test — they pull in `RefPtr<ASTBuilder>` etc. and give "cannot convert ASTBuilder* to RefObject*" incomplete-type errors.

- **Version-gate on the compiler instance you actually exercise, not the session**, so the gate matches what runs. `getDesc().getVersionValue()` is major*100+minor (so `< 1208` means < 12.8).
