---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787175454638-msmmcf
written_at: 2026-08-20T12:09:36.278Z
---

# Resolve OptiX prelude version-gate thresholds from optix-dev git tags, and verify GPU-free with nvcc

When gating a `slang-cuda-prelude.h` helper by `OPTIX_VERSION` (bug class: an OptiX N.x symbol used unconditionally breaks NVRTC compile against older SDKs, since the whole prelude is fed to NVRTC verbatim — e.g. #12639 optixTraverse, #8723/#8730 optixMakeHitObject), do NOT guess the threshold from memory. The `external/optix-dev` submodule has every version as a git tag:

```bash
cd external/optix-dev
git fetch --depth 1 origin refs/tags/v7.5.0:refs/tags/v7.5.0   # and v8.0.0, v8.1.0, ...
git show v7.5.0:include/optix_device.h | grep -c 'void optixTraverse('   # 0 = absent
git show v8.0.0:include/optix_device.h | grep -c 'void optixTraverse('   # 2 = present
```
⚠ TRAP: in OptiX **7.x** the real device decls live in `optix_7_device.h` (the plain `optix_device.h` is a 47-line wrapper that just `#include "optix_7_device.h"`). Grepping only `optix_device.h` for a 7.x tag gives a false "absent" for symbols that ARE there. Check `optix_7_device.h` + `internal/optix_7_device_impl.h` for 7.x. If the signature is unchanged across the candidate tiers (e.g. 8.0==8.1), use a SINGLE `#if (OPTIX_VERSION >= N)` — no tiering (tiering like #8730's is only needed when the signature changes between versions, e.g. 8.1→9.0).

**Verify GPU-free** (nvcc 12.6 at /usr/local/cuda-12.6, no GPU needed for compile):
1. Extract old headers: `git archive v7.5.0 include/ | tar -x -C /tmp/optix75/`
2. Prelude probe: `printf '#define SLANG_CUDA_ENABLE_OPTIX 1\n#include "<worktree>/prelude/slang-cuda-prelude.h"\n' > p.cu; nvcc -c p.cu -o /dev/null -I/tmp/optix75/include -arch=sm_75` — count `error:` before vs after fix (reports ALL failures). Avoid `SLANG_CUDA_ENABLE_HALF` (CUDA 12.6 `__half2` operator clash is a pre-existing confound).
3. End-to-end (reporter's repro): built `slangc <shader> -target ptx -Xnvrtc -I/tmp/optix75/include ...` — NVRTC stops at the FIRST failed overload so it reports 1 error where the standalone probe reports N. slang-test loads the prelude by ON-DISK PATH (source/core/slang-test-tool-util.cpp), not embedded, so a worktree build uses the edited prelude.

**No committed test is often correct here**: the in-tree headers are 9.0, so no CI test can fail-before/pass-after (the #10503 coverage gap); precedent #8730 shipped testless. Document the out-of-band verification + gap in the PR body instead of adding a duplicative bundled-header test.
