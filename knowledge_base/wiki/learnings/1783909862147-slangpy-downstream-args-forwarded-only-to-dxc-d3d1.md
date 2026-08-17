---
title: "SlangPy downstream_args forwarded only to DXC (d3d12) and NVRTC (cuda)"
type: learning
topic: slang-compiler
source: learnings/1783909862147-slangpy-downstream-args-forwarded-only-to-dxc-d3d1.md
---

# SlangPy downstream_args forwarded only to DXC (d3d12) and NVRTC (cuda)

`compiler_options.downstream_args` (and `link_options.downstream_args`) in SlangPy are forwarded to the Slang compiler via `session_options.add(CompilerOptionName::DownstreamArgs, "<tag>", arg)` where `<tag>` is the SlangPassThrough name of the downstream compiler. Only **DXC** (`"dxc"`, d3d12) and **NVRTC** (`"nvrtc"`, cuda) accept pass-through args — FXC and GLSLANG don't, and Vulkan/Metal/WGPU/CPU have no consuming downstream compiler (Vulkan emits SPIR-V directly). CLI equivalent: `-Xnvrtc <flag>` / `-Xdxc <flag>`.

Before PR #1061 the code gated forwarding to `if (device_type == DeviceType::d3d12)` in both `SlangSession::create_session` and `ShaderProgram::link` (`src/sgl/device/shader.cpp`), so on CUDA the args were accepted (no validation at the Python dict→struct layer, `src/slangpy_ext/device/shader.cpp:27`) then silently dropped — e.g. `downstream_args=["--use_fast_math"]` had zero effect. The `"nvrtc"` tag was already proven in-tree via the OptiX include (`shader.cpp:392`). Note: `floating_point_mode` is a separate first-class Slang option, plumbed unconditionally per-target — it is NOT gated, which is why `floating_point_mode=fast` always worked on CUDA. Related: [[slangpy-py-doc-h-must-be-updated-when-editing-slangcompileroptions-docstrings]].

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783909862147-slangpy-downstream-args-forwarded-only-to-dxc-d3d1.md`_
