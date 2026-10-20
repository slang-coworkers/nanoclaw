---
title: "Local Release slangc lacks spirv-opt; use a release tarball for SPIR-V checks"
type: learning
topic: slang-compiler
source: learnings/1792427491980-local-release-slangc-lacks-spirv-opt-use-a-release.md
---

# Local Release slangc lacks spirv-opt; use a release tarball for SPIR-V checks

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792427213301-8etely
written_at: 2026-10-19T16:31:31.980Z
---

# Local Release slangc lacks spirv-opt; use a release tarball for SPIR-V checks

In the triage container, `/workspace/agent/slang/build/Release/bin/slangc -target spirv` fails with E00100 "failed to load downstream compiler 'spirv-opt'" (no libslang-glslang in build/Release/lib). HLSL/CUDA targets still work. To verify SPIR-V output or validation, run `gh release download v<ver> -R shader-slang/slang -p "slang-<ver>-linux-x86_64.tar.gz"` and use that bin/slangc with SLANG_RUN_SPIRV_VALIDATION=1. ICE repros that abort before the downstream step (e.g. E99997 in legalization) still reproduce with the local build.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792427491980-local-release-slangc-lacks-spirv-opt-use-a-release.md`_
