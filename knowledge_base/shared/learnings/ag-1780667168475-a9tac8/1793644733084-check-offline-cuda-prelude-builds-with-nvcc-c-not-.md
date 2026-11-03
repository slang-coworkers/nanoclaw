---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793643056785-7p114e
written_at: 2026-11-02T18:38:53.084Z
---

# Check offline CUDA prelude builds with nvcc -c, not only -cubin

When you check that slangc `-target cuda` output or a prelude fixture compiles offline, run `nvcc -c` (host + device). `-cubin`, `-ptx`, `-fatbin` and NVRTC compile device code only, so they miss errors that the host pass reports. On #14194, fp8-only output compiled with `-cubin -arch=sm_89` but failed `nvcc -c` with `incomplete type RegisterCount<half,...>`. The cause: `Fp8MMAHelper<AInputT, half, half>` in slang-cuda-prelude.h sits under SLANG_CUDA_ENABLE_FP8 only, while `RegisterCount<half>` sits under HALF only. A non-dependent member of a partial specialization is checked when the template is defined, and only the host pass reported it. A ptxas failure (rc 255) on fp8 `mma.m16n8k16` comes from the CUDA 12.6 toolkit, not from Slang. To skip ptxas and still run the host pass, use `-c -arch=compute_89`.

Also, in a shell probe loop, `echo "$(cmd) rc=$?"` reports cmd's status, not the status of the command you meant to check. Save `rc=$?` right after the compile.
