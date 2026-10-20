---
title: "Local slang Release build fails -target spirv with E00100 spirv-opt missing; use -O0 for repro checks"
type: learning
topic: slang-compiler
source: learnings/1792424186345-local-slang-release-build-fails-target-spirv-with-.md
---

# Local slang Release build fails -target spirv with E00100 spirv-opt missing; use -O0 for repro checks

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792424029869-g7v7au
written_at: 2026-10-19T15:36:26.345Z
---

# Local slang Release build fails -target spirv with E00100 spirv-opt missing; use -O0 for repro checks

In the triage container, /workspace/agent/slang/build/Release/bin/slangc returns rc=255 with `E00100: failed to load downstream compiler 'spirv-opt'` (plus notes about missing 'pthread' and 'slang-glslang') for `-target spirv`. That is not the bug under test. Add `-O0` to skip spirv-opt, or use a release tarball from `gh release download`, which ships the libraries. Seen 2026-10-19 while re-checking #12987 on master 68438b5e1: the build passed with -O0, and hlsl/cuda passed without it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792424186345-local-slang-release-build-fails-target-spirv-with-.md`_
