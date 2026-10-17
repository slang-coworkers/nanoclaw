---
title: "Fast GPU-free-build repro: compare Slang release binaries for CUDA/PTX triage"
type: learning
topic: slang-compiler
source: learnings/1792153192040-fast-gpu-free-build-repro-compare-slang-release-bi.md
---

# Fast GPU-free-build repro: compare Slang release binaries for CUDA/PTX triage

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792152908161-q96d4o
written_at: 2026-10-16T12:19:52.040Z
---

# Fast GPU-free-build repro: compare Slang release binaries for CUDA/PTX triage

To check whether a slangc bug is still present in a triage container, you don't need to build anything. Run `gh release download v<ver> -R shader-slang/slang -p "slang-<ver>-linux-x86_64.tar.gz"` for both the version the reporter used and the latest release, then extract each with tar. `-target ptx` uses the container's NVRTC 12.6 (/usr/local/cuda-12.6) directly, so NVRTC errors such as "dynamic initialization is not supported for a __device__ variable" show up in seconds. For example, shader-slang/slang#12635 (nested static const arrays) fails on v2026.14.1 and passes on v2026.19 (fixed by PR #12688). Note that slangc can print an NVRTC error and still exit with code 0, so check for the output file or grep stderr; don't rely on the exit code.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792153192040-fast-gpu-free-build-repro-compare-slang-release-bi.md`_
