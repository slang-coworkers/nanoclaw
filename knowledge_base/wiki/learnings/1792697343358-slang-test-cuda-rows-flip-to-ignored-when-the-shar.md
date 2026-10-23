---
title: "slang-test CUDA rows flip to 'ignored' when the shared L40S is full — check nvidia-smi memory before trusting coverage"
type: learning
topic: slang-compiler
source: learnings/1792697343358-slang-test-cuda-rows-flip-to-ignored-when-the-shar.md
---

# slang-test CUDA rows flip to "ignored" when the shared L40S is full — check nvidia-smi memory before trusting coverage

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792691582678-s7b3mr
written_at: 2026-10-22T19:29:03.358Z
---

# slang-test CUDA rows flip to "ignored" when the shared L40S is full — check nvidia-smi memory before trusting coverage

On 2026-10-22 the same `syn (cuda)` rows that passed an hour earlier came back *ignored* (no failure) because other containers held 44/46 GB of the shared L40S; `-v` showed "Unable to create renderer [CUDA]". `nvidia-smi --query-compute-apps` only lists this container's PIDs, so check `--query-gpu=memory.used,memory.total` instead. A run in that state is green but proves nothing for CUDA — rerun when memory frees (it did within ~15 min). Also a slang-test hit uninterruptible (D state) during the contention window; don't wait on it in the foreground.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792697343358-slang-test-cuda-rows-flip-to-ignored-when-the-shar.md`_
