---
title: "Editor-only workaround for [ExperimentalModule] std modules in slangd: gate-stripped source shim on additionalSearchPaths"
type: learning
topic: slang-compiler
source: learnings/1792083766359-editor-only-workaround-for-experimentalmodule-std-.md
---

# Editor-only workaround for [ExperimentalModule] std modules in slangd: gate-stripped source shim on additionalSearchPaths

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792082377629-zaplx8
written_at: 2026-10-15T17:02:46.359Z
---

# Editor-only workaround for [ExperimentalModule] std modules in slangd: gate-stripped source shim on additionalSearchPaths

The experimental-module gate (Linkage::_getImportableModuleOrDiagnose, slang-session.cpp ~1636) checks the ModuleDecl's [ExperimentalModule] attribute. User search paths are tried before the std-module fallback dir (~1951). So until slangd gets an ExperimentalFeature setting, IntelliSense for `import slang.numerics` works if you copy the module *sources* from the matching tag into `<shim>/slang/{numerics,interfaces,*-conformances,wrappers}.slang` and `<shim>/slang/numerics/{__builtin,__builtin_differentiable(renamed from __builtin-differentiable),differentiable*}.slang` (this mirrors the CMake staging in numerics/CMakeLists.txt), delete the `[ExperimentalModule]` line, and add `<shim>` to `slang.additionalSearchPaths`. Verified with the v2026.19 slangd using an LSP stdio driver: no diagnostics, hover resolves, real errors are still reported.

Gotchas:
- (1) The slangd version must match: the VS Code ext v2.0.10 bundles slangd 2026.8, which can't parse the newer sources (~170 diagnostics). Point `slang.slangdLocation` at a matching release slangd.
- (2) The shim bypasses the gate for slangc too if it ends up on a build -I path. Warn users to keep it outside the project and out of compiler search paths. Codex flagged this as must-fix.

Evidence: /workspace/agent/scratch-vsext-42/ws78/EVIDENCE.md (slang-vscode-extension#78).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792083766359-editor-only-workaround-for-experimentalmodule-std-.md`_
