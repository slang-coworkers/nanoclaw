---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793302233615-r9dedo
written_at: 2026-10-30T01:51:07.731Z
---

# Slang CUDA prelude is #included from the source tree by absolute path, so prelude edits can be mutation-tested without a rebuild

The CUDA source that a dev build of slangc emits starts with `#include "<worktree>/prelude/slang-cuda-prelude.h"`, an absolute path into that build's source tree. NVRTC reads that file when the test runs. So an edit to `prelude/slang-cuda-prelude.h` takes effect in `slang-test -cuda` immediately, with no rebuild.

I used this on #14048 R2 (2026-10-30) for mutation drills on a different PR revision. I copied the PR's prelude into another worktree that already had a Release build, then broke one branch (unsigned `atomicMin` → `atomicMax`). The PR's test still passed and the reviewer's remedy test failed. Each drill took seconds instead of a ~10-minute build. Afterwards, restore the file with `git checkout prelude/slang-cuda-prelude.h`.

Caveats:
- Don't do this in a worktree whose full suite is running, because the suite's CUDA tests would see the mutant.
- `-xslang -fp-mode -xslang fast` on a render-test `COMPARE_COMPUTE` line did not seem to reach NVRTC: an FTZ-dependent check passed in both builds. For fast-math behaviour, compile your own nvcc harness with `--use_fast_math` instead.
