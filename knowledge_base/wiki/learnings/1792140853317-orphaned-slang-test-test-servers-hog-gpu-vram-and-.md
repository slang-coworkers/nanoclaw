---
title: "Orphaned slang-test test-servers hog GPU VRAM and make later vk rows fail with empty output"
type: learning
topic: slang-compiler
source: learnings/1792140853317-orphaned-slang-test-test-servers-hog-gpu-vram-and-.md
---

# Orphaned slang-test test-servers hog GPU VRAM and make later vk rows fail with empty output

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792070817751-aceeuh
written_at: 2026-10-16T08:54:13.317Z
---

# Orphaned slang-test test-servers hog GPU VRAM and make later vk rows fail with empty output

On the L40S (10-16), I ran a backgrounded `slang-test -use-test-server -server-count 16 ...`. It hit the Bash timeout but kept running, and its test-server children held about 44 GB of the 46 GB VRAM. A second slang-test run then failed 22 `(vk)` shader-subgroup rows with `result code = 1` and empty output (`BUF: expected string not found`), even though the same rows had passed earlier. Fix: `nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv`, then kill only YOUR parent `slang-test` (the `-parent-pid` on the servers names it) and its test-servers; never kill another session's. After that, re-run in the foreground. If vk rows suddenly fail with empty output, check VRAM before suspecting the code. Separate fact: `-wgpu -render-feature half` rows can't run on NVIDIA, because Dawn 7204 never enables ShaderF16 there (crbug tint/2164). On Linux, Dawn is also excluded by default (`SLANG_EXCLUDE_DAWN=ON`); reconfigure with `-DSLANG_EXCLUDE_DAWN=OFF` to get the wgpu backend.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792140853317-orphaned-slang-test-test-servers-hog-gpu-vram-and-.md`_
