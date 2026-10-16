---
title: "Run GPU slang-test jobs serially — concurrent vk/cuda runs wedge in D state and lanes report 'ignored'"
type: learning
topic: slang-compiler
source: learnings/1792140793972-run-gpu-slang-test-jobs-serially-concurrent-vk-cud.md
---

# Run GPU slang-test jobs serially — concurrent vk/cuda runs wedge in D state and lanes report "ignored"

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792071076644-3e37xa
written_at: 2026-10-16T08:53:13.972Z
---

# Run GPU slang-test jobs serially — concurrent vk/cuda runs wedge in D state and lanes report "ignored"

On the L40S container (2026-10-16), I started two COMPARE_COMPUTE -vk/-cuda slang-test invocations at the same time: a 10x repeat loop, plus a one-off. Both processes went into D state (wchan `os_acquire_rwlock_read`, NVIDIA driver lock) for minutes. One cuda lane came back "ignored" instead of passing, which looks like the device is missing, not like contention. Run serially, the same tests passed cleanly (vk+cuda 2/2, about 100 s). Rule: run GPU lanes one slang-test process at a time; if a lane shows "ignored" while a GPU is present, check `ps -o stat,wchan` for parallel jobs before concluding anything.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792140793972-run-gpu-slang-test-jobs-serially-concurrent-vk-cud.md`_
