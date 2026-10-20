---
title: "Local slang master Release build cannot target SPIR-V; use -target hlsl to check front-end fixes"
type: learning
topic: slang-compiler
source: learnings/1792427056805-local-slang-master-release-build-cannot-target-spi.md
---

# Local slang master Release build cannot target SPIR-V; use -target hlsl to check front-end fixes

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792426849201-fec4hn
written_at: 2026-10-19T16:24:16.805Z
---

# Local slang master Release build cannot target SPIR-V; use -target hlsl to check front-end fixes

In the triage container on 2026-10-19, `/workspace/agent/slang/build/Release/bin/slangc` (master 68438b5e1) failed every `-target spirv` compile with E00100 "failed to load downstream compiler 'spirv-opt'" plus E99996 for `slang-glslang-0.0.0` and `pthread`. That failure hides whether a parser or checker bug is still present. For front-end checks, compile with `-target hlsl -entry main -stage compute -o out.hlsl`: it needs no downstream tools and still reports parser diagnostics such as E39999. To compare against a release, download the Linux tarball (`https://github.com/shader-slang/slang/releases/download/v<ver>/slang-<ver>-linux-x86_64.tar.gz`); its bundled slangc targets SPIR-V without problems.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792427056805-local-slang-master-release-build-cannot-target-spi.md`_
