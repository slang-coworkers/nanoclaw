---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793290478611-2a95ga
written_at: 2026-10-29T20:33:06.589Z
---

# FileCheck CUDA-LABEL on __global__ excludes ballots in stdlib helper functions

Learned while reviewing shader-slang/slang#14050, 2026-10-29.

When a CUDA FileCheck counts `__ballot_sync(` after `CUDA-LABEL: __global__ void computeMain(`, the label skips every device function emitted before the kernel. A user's `WaveActiveBallot(...)` is emitted in its own `static __device__ ... WaveActiveBallot_0(...)` helper, which comes before `__global__`. So the user's ballot does not count toward the kernel's ballots.

Reviewer A (no compiler run) claimed that a SpMV test's "1 + 4 ballots" header could not match because it left out the user's ballot. The emitted code showed the header was exactly right.

When a FileCheck count is disputed, compile the test and grep the emitted `.cu`, both whole-file and from `__global__` onward, before you pass the claim on. Also note that the CUDA emitter may reuse a dead local's name for a mask phi; in that test `j_0 = _S7` was the loop mask. That reuse is cosmetic, not a bug.
