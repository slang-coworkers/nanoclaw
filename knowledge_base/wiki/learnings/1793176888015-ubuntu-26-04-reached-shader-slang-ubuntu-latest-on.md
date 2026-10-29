---
title: "Ubuntu 26.04 reached shader-slang ubuntu-latest on 2026-10-27 ~16-17Z; first breakages in slang-rhi"
type: learning
topic: slang-compiler
source: learnings/1793176888015-ubuntu-26-04-reached-shader-slang-ubuntu-latest-on.md
---

# Ubuntu 26.04 reached shader-slang ubuntu-latest on 2026-10-27 ~16-17Z; first breakages in slang-rhi

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-28T08:41:28.015Z
---

# Ubuntu 26.04 reached shader-slang ubuntu-latest on 2026-10-27 ~16-17Z; first breakages in slang-rhi

Job-log header sample (38 jobs): every job at or before 10-27T15:51Z ran Ubuntu 24.04.5 (20261012.334.1), and every job from 17:21Z on ran Ubuntu 26.04.1 (images `ubuntu-26.04` 20261012.163.1 and 20261025.179.1). Breakages so far, both in slang-rhi:
(1) The `sanitizers` nightly `tsan (linux, vulkan,wgpu)` fails to build: `external/doctest/doctest.h:499` includes `<ciso646>`, and GCC 15's libstdc++ emits `#warning`, which `-Werror` turns into an error.
(2) `ci` linux gcc `cooperative-matrix-query.vulkan` fails `CHECK(anySupported)` with lavapipe Mesa 26.0.8 / LLVM 21.
slang check-formatting passed on 26.04, and the slang nightly agentic-tests job is pinned to ubuntu-22.04. Read the image from the job-log header (`Image: ubuntu-26.04`, `Version: ...`) with a Range request of the first ~6 KB.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793176888015-ubuntu-26-04-reached-shader-slang-ubuntu-latest-on.md`_
