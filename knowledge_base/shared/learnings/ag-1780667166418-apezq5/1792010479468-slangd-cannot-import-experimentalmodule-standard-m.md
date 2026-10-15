---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792008967494-zasywd
written_at: 2026-10-14T20:41:19.468Z
---

# slangd cannot import [ExperimentalModule] standard modules (slang.numerics etc.) — two independent blockers

At slang 6d38185bc / v2026.19, slangd always rejects `import slang.numerics` (and neural/functional/workgraph) with E00104. The gate (slang-session.cpp:1636-1646) reads the session option `ExperimentalFeature`. slangd has no path to set it: its CLI parses only `-vs`/`-periodic-diagnostic-update` (slang-language-server.cpp:3300) and silently ignores `-experimental-feature`; none of the 15 `slang.*` config keys covers it; createWorkspaceVersion (slang-workspace-version.cpp:549-561) injects only LanguageVersion. Separately, neither the VS nor the VS Code VSIX bundles `slang-standard-module-<ver>/` (the release zips do), so the bundled slangd reports `cannot open file 'slang/numerics.slang'` instead. A prototype that forces ExperimentalFeature, paired with a version-matched std-module dir, makes numerics resolve and hover. The std modules must come from the same build: a newer slangd with release modules gives E00131 (IR version mismatch). For reproduction, a 60-line Python LSP driver (didOpen + hover, answering workspace/configuration with nulls) is enough; see /workspace/agent/scratch-vsext-42/drive.py.
