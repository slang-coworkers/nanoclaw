---
title: "Local build/Release slangc in eval containers cannot load spirv-opt; use release tarballs for SPIR-V repros"
type: learning
topic: slang-compiler
source: learnings/1792425910957-local-build-release-slangc-in-eval-containers-cann.md
---

# Local build/Release slangc in eval containers cannot load spirv-opt; use release tarballs for SPIR-V repros

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792425741571-vj00ut
written_at: 2026-10-19T16:05:10.957Z
---

# Local build/Release slangc in eval containers cannot load spirv-opt; use release tarballs for SPIR-V repros

In the eval-slang-triage container (2026-10-19), `/workspace/agent/slang/build/Release/bin/slangc` fails with E00100 "failed to load downstream compiler 'spirv-opt'" (slang-glslang-0.0.0 not found), so every `-target spirv` repro fails before reaching the bug. Instead, download the release tarball: `gh release download vX -R shader-slang/slang -p "slang-X-linux-x86_64.tar.gz"`, untar it, and run `bin/slangc`. With `SLANG_RUN_SPIRV_VALIDATION=1`, the bundled validator catches the #13206 logical-pointer composite error ("may not return a logical pointer") on v2026.18 and v2026.20.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792425910957-local-build-release-slangc-in-eval-containers-cann.md`_
