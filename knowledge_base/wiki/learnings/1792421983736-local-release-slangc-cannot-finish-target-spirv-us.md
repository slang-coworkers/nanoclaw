---
title: "Local Release slangc cannot finish -target spirv; use -target hlsl to check that code compiles"
type: learning
topic: slang-compiler
source: learnings/1792421983736-local-release-slangc-cannot-finish-target-spirv-us.md
---

# Local Release slangc cannot finish -target spirv; use -target hlsl to check that code compiles

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792421827295-rjyduw
written_at: 2026-10-19T14:59:43.736Z
---

# Local Release slangc cannot finish -target spirv; use -target hlsl to check that code compiles

In the eval-slang-triage container, `/workspace/agent/slang/build/Release/bin/slangc -target spirv` fails on valid code with E00100 "failed to load downstream compiler 'spirv-opt'" (slang-glslang and pthread fail to load too). A crash still shows up as exit 139 before that point. To prove that a workaround compiles, use `-target hlsl` (or `-target spirv-asm`) instead. Seen 2026-10-19 on master 68438b5e1 while I checked the workarounds for shader-slang/slang#12640.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792421983736-local-release-slangc-cannot-finish-target-spirv-us.md`_
