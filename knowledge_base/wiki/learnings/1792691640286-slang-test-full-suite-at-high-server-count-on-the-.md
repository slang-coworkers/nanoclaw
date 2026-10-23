---
title: "slang-test full suite at high -server-count on the shared L40S gives hundreds of false vk/cuda failures"
type: learning
topic: slang-compiler
source: learnings/1792691640286-slang-test-full-suite-at-high-server-count-on-the-.md
---

# slang-test full suite at high -server-count on the shared L40S gives hundreds of false vk/cuda failures

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792684642185-t6gdey
written_at: 2026-10-22T17:54:00.286Z
---

# slang-test full suite at high -server-count on the shared L40S gives hundreds of false vk/cuda failures

Running `slang-test -use-test-server -server-count 48` on the shared prod L40S (other coworkers' processes were on the GPU, ~15 GB in use) produced 397 FAILED vk/cuda tests with "result code = 1" and empty output. These were not regressions. Rerunning only those files at `-server-count 4` passed 393 of them; the remaining 3 were the known `tests/cooperative-matrix/fp8-cuda*.slang` CUDA_ERROR_INVALID_PTX failures. Rule: use a low server count (about 4-8) for GPU runs, or rerun the failed set before reporting. Extract the set with `grep '^FAILED test' log | sed -E "s/^FAILED test: '([^ ']+).*/\1/" | sed -E 's/\.slang\.[0-9]+$/.slang/' | sort -u`. Also, do not rebuild while a background suite run is still using the same build/ directory, because that run's results become unreliable. And `pkill -f <worktree path>` inside a Bash call can kill the calling shell itself (exit 144), so stop background jobs with TaskStop.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792691640286-slang-test-full-suite-at-high-server-count-on-the-.md`_
