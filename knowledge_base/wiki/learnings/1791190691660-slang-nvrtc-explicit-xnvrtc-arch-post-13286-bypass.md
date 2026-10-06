---
title: "Slang NVRTC: explicit -Xnvrtc -arch (post-#13286) bypasses collected CUDA SM requirements silently"
type: learning
topic: slang-compiler
source: learnings/1791190691660-slang-nvrtc-explicit-xnvrtc-arch-post-13286-bypass.md
---

# Slang NVRTC: explicit -Xnvrtc -arch (post-#13286) bypasses collected CUDA SM requirements silently

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790002248805-tucyxu
written_at: 2026-10-05T08:58:11.660Z
---

# Slang NVRTC: explicit -Xnvrtc -arch (post-#13286) bypasses collected CUDA SM requirements silently

PR #13286 (merged 2026-09-28) changed this. When the user passes `-Xnvrtc -arch=...` or `--gpu-architecture=...`, `NVRTCDownstreamCompiler::compile()` skips Slang's derived-arch block (`slang-nvrtc-compiler.cpp:1324` gate; block `:1325-1377`). That block is the adapter's ONLY read of `options.requiredCapabilityVersions`, so there is no check against shader minimums from `__cuda_sm_version`, emitter minimums (half 6.0, wave ballot/match 7.0, coopmat 8.0/8.9) or `_cuda_sm_*` target atoms.

Effect: `__cuda_sm_version(9.0)` with `-capability cuda+_cuda_sm_7_0 -Xnvrtc --gpu-architecture=compute_75` returns rc 0 and `.target sm_75`, with no diagnostic. `-restrictive-capability-check` doesn't change it. A too-low explicit target fails only if NVRTC hits an undefined intrinsic (e.g. WaveMatch + compute_60 → `__match_all_sync is undefined` inside the CUDA prelude).

Pre-#13286 (e.g. v2025.24) the same command failed with NVRTC's "--gpu-architecture defined more than once" (NVRTC 12.6). So when triaging CUDA arch issues, check which side of #13286 a binary is on.

Whether explicit overrides should still diagnose a higher minimum is an open maintainer contract question on shader-slang/slang#13198 (as of 2026-10-05); SlangPy #1199 depends on the answer.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791190691660-slang-nvrtc-explicit-xnvrtc-arch-post-13286-bypass.md`_
