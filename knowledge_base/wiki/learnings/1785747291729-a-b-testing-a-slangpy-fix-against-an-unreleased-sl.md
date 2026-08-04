---
title: "A/B testing a slangpy fix against an unreleased Slang PR (local Slang build)"
type: learning
topic: slang-compiler
source: learnings/1785747291729-a-b-testing-a-slangpy-fix-against-an-unreleased-sl.md
---

# A/B testing a slangpy fix against an unreleased Slang PR (local Slang build)

# A/B testing a slangpy fix against an unreleased Slang PR

Context: proving slangpy's `hlsl_nvapi` guard fix (src/sgl/device/shader.cpp) against
shader-slang/slang#11225, which turns an incompatible requested capability into a hard error.

## Gotchas found

1. **Read the clone log before trusting `git log -1`.** A background
   `git clone && git fetch pull/N/head && git checkout FETCH_HEAD && git submodule update`
   script shows HEAD on `master` if you look during the `fetch` window. `git for-each-ref`
   showed only master refs and `.git/FETCH_HEAD` existed but was unparsed by
   `git log FETCH_HEAD` ("ambiguous argument"). Re-check after the checkout line appears in
   the log. Verify the PR is genuinely unmerged with
   `git merge-base --is-ancestor <pr-head> origin/master`.

2. **`git checkout <commit> -- <path>` stages as well as writes the worktree**, so a plain
   `git diff` afterwards is EMPTY and looks like the revert did nothing. Use `git diff HEAD`
   (or `git status --porcelain`, which shows `M ` with the M in column 1) to see it. To restore,
   `git reset --hard <commit>` clears both index and worktree; `git checkout <commit> -- <path>`
   leaves the path staged.

3. **Slang's `default` CMake preset is Ninja Multi-Config**, so `-DCMAKE_BUILD_TYPE=Release`
   is inert — `cmake --build build --config Release` is what selects the config. slangpy's
   `SGL_LOCAL_SLANG_BUILD_DIR` must then point at `build/Release` (it reads
   `$DIR/$BUILD_DIR/lib/libslang-compiler.so` and requires
   `$DIR/$BUILD_DIR/include/slang-tag-version.h` for the version, else a FATAL_ERROR).

## Mechanism facts (verified in the PR source, not assumed)

- Diagnostic E36121 is declared in `source/slang/slang-diagnostics.lua` (a build-time
  generator — grepping only `.cpp/.h` for the diagnostic *name* finds nothing; the emission
  site uses the generated CamelCase symbol
  `Diagnostics::RequestedCapabilityIncompatibleWithTarget` in `slang-target.cpp`).
- Emitted from `TargetRequest::checkCapabilities`, called from
  `FrontEndCompileRequest::checkEntryPoints` for every target => reachable on any compile.
- It only inspects `CompilerOptionName::Capability` entries — exactly what slangpy's
  `session_options.add(Capability, findCapability("hlsl_nvapi"))` sets.
- `hlsl_nvapi` is `def hlsl_nvapi : hlsl;` in `slang-capabilities.capdef`, i.e. strictly in the
  hlsl target family, so it IS incompatible with spirv. The PR's GLSL escape hatch
  (`isGLSLBasedTarget() && cap contains spirv atom -> skip`) does not rescue it, and slangpy's
  vulkan path sets `SLANG_SPIRV` + `GENERATE_SPIRV_DIRECTLY` (not GLSL-based) => target prints
  as `spirv`.
- `-ignore-capabilities` suppresses E36121; slangpy does not pass it.

## Container/GPU facts (this image)

- `/etc/vulkan/icd.d/nvidia_icd.json` is the real ICD; `/usr/share/vulkan/icd.d/` holds only
  intel/radeon/lavapipe, so listing just the latter makes it look like there's no NVIDIA Vulkan.
- A ctypes `vkCreateInstance` + `vkEnumeratePhysicalDevices` probe is a quick way to prove a
  usable GPU without installing `vulkaninfo`: reported an NVIDIA L40S plus lavapipe.
- `tests/sgl/testing.cpp` `run_gpu_test` uses `{d3d12, vulkan}` on Windows but **vulkan only on
  Linux** — so a Linux `sgl_tests` run does exercise the SPIRV path that triggers this error.
- `SGL_HAS_NVAPI` is `0` on Linux (set ON only when the `slang-rhi-nvapi` target exists, which
  is Windows/D3D12). **Consequence for this A/B:** the fix's first clause alone short-circuits
  on Linux, so the guard's effect is fully observable there, but a Linux run canNOT distinguish
  the `SGL_HAS_NVAPI` clause from the `device_type == d3d12` clause.
- Baseline `sgl_tests` on the pinned Slang 2026.12 already has 5 pre-existing failures
  (3x dds_file "invalid header", 2x texture_loader "Unsupported source image type") unrelated to
  capabilities — establish this control before the A/B or you'll misattribute them.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785747291729-a-b-testing-a-slangpy-fix-against-an-unreleased-sl.md`_
