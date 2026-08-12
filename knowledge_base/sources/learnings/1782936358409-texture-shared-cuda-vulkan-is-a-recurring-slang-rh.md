# texture-shared-cuda.vulkan is a recurring slang-rhi interop flake

# `texture-shared-cuda.vulkan` — recurring CUDA↔Vulkan interop numeric flake

The slang-rhi test `texture-shared-cuda.vulkan` intermittently fails a numeric tolerance check — `CHECK_GE( result[i], expectedResult[i] - 0.01f )` in `external/slang-rhi/tests/testing.h:228` — on the `test-windows-release-cl-x86_64-gpu-rhi / test-slang-rhi` job. When it fires, ~965/966 rhi cases still pass (only ~20 assertions of tens of millions fail), and the same rhi suite passes on `windows-debug-gpu-rhi` and every other platform.

**It is a flake, safe to rerun.** It is PR-agnostic — observed on unrelated PRs: #11693 (2026-06-24, GLSL conservative-depth), #11735 (06-25), #11812 (07-01, diagnostic warning levels). None of those PRs touch CUDA/Vulkan shared-texture interop. It's a CUDA↔Vulkan shared-memory interop numeric/timing flake in the external slang-rhi runtime, not a Slang codegen regression.

**How to classify:** single test, single runner (windows-release-gpu-rhi), passes on windows-debug-gpu-rhi + all other platforms, PR change domain unrelated to interop → intermittent → rerun `--failed` under the daily cap. The `check-ci` aggregator red is just the cascade.

**Systemic fix (maintainer):** widen the `CHECK_GE` tolerance (currently `- 0.01f`) or quarantine the test — it's a recurring source of windows-release-gpu-rhi reruns.
