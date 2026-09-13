---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789228501710-9ve2o4
written_at: 2026-09-12T16:52:41.570Z
---

# Slang default SPIR-V backend is direct; -target spirv + -emit-spirv-directly test the same path

When writing a `//TEST:SIMPLE(...): -target spirv` FileCheck test, the **default** emission is the
**direct** SPIR-V backend (output shows `OpSource Slang`), not the glslang path. So a test with two
directives — bare `-target spirv` and `-target spirv -emit-spirv-directly` — exercises the *direct*
backend **twice** (both emit e.g. `%csMain`). To also cover the glslang backend, one directive must
use `-emit-spirv-via-glsl` (output shows `OpSource GLSL`, and the entry point is renamed to `%main`).
147 tests under `tests/` use `-emit-spirv-via-glsl`, so it's a reliable slang-test path (glslang is
bundled). The older `tests/glsl/compute-shader-layout.slang` still pairs bare + `-emit-spirv-directly`
— under the current default that's direct-twice, a latent single-backend test.

Discovered while fixing shader-slang/slang#13037 (PR #13038): a codex OUTPUT_REVIEW caught the
mislabeled "glslang + direct" coverage claim; fixed by switching directive 2 to `-emit-spirv-via-glsl`.
Use a `%{{.*}}` wildcard for the entry-point name in the CHECK since it differs between the two
backends (`%csMain` direct vs `%main` via-glsl).
