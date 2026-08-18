---
title: "slangpy downstream_args only forwarded for D3D12 (dropped on CUDA/NVRTC)"
type: learning
topic: slang-compiler
source: learnings/1783910132054-slangpy-downstream-args-only-forwarded-for-d3d12-d.md
---

# slangpy downstream_args only forwarded for D3D12 (dropped on CUDA/NVRTC)

In SlangPy (sgl layer), `SlangCompilerOptions.downstream_args` (from Python `compiler_options`) is forwarded to the Slang compiler **only for the D3D12 target**, hardcoded to the `"dxc"` pass-through tag, in BOTH the compile and link paths:
- Compile path: `src/sgl/device/shader.cpp` `create_session`, loop gated `if (device_type == DeviceType::d3d12)` → `session_options.add(CompilerOptionName::DownstreamArgs, "dxc", arg)` (~shader.cpp:322-326, and ~:381 depending on tree state).
- Link path: `ShaderProgram::link`, same d3d12-only gate + `"dxc"` (~shader.cpp:1540-1543 / ~:1633).

Consequence: for CUDA (and Vulkan/Metal/WGPU/CPU) user-supplied `downstream_args` are accepted (dict→struct at `src/slangpy_ext/device/shader.cpp:27`, no validation) then **silently dropped**. This is why `downstream_args=["--use_fast_math"]` no-ops on CUDA (issue #1058).

Key distinctions verified:
- `floating_point_mode` is a FIRST-CLASS Slang option, applied unconditionally per-target at `shader.cpp:397-398` (`target_desc.floatingPointMode` + `target_options.add(FloatingPointMode, ...)`). So `floating_point_mode=fast` DOES work on CUDA — it is not the same mechanism as downstream_args.
- CUDA target format = `SLANG_PTX` (`shader.cpp:429`); NVRTC is the downstream compiler and its pass-through tag is `"nvrtc"` (proven in-tree by the auto OptiX-include forwarding at `shader.cpp:334`). Correct fix = add a CUDA branch forwarding each arg via `add(DownstreamArgs, "nvrtc", arg)` (CLI form `-Xnvrtc <flag>`). Only DXC and NVRTC consume pass-through args (per DeepWiki), so a CUDA-only branch is sufficient; a general per-backend switch is optional.

Cross-backend transcendental-default difference (CUDA precise vs Vulkan/Metal driver fast approx) is NOT a slangpy plumbing bug — it's downstream toolchain/driver behavior on the default fp mode; handle as docs, don't flip the default (changes numeric results). Fixed in draft PR shader-slang/slangpy#1061.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783910132054-slangpy-downstream-args-only-forwarded-for-d3d12-d.md`_
