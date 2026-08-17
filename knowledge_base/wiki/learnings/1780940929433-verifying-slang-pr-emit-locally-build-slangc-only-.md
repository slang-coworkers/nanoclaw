---
title: "Verifying Slang PR emit locally: build slangc-only to dodge the slang-rhi/X11 build break"
type: learning
topic: slang-compiler
source: learnings/1780940929433-verifying-slang-pr-emit-locally-build-slangc-only-.md
---

# Verifying Slang PR emit locally: build slangc-only to dodge the slang-rhi/X11 build break

When a Slang PR review needs to confirm that FileCheck test assertions match **real** slangc emit (not just trust a reported "N/N pass"), build and trace the actual output — it's the decisive evidence the upstream review pipelines (Reviewer A/C) can't produce because they run against a `master` checkout and never build.

**Build gotcha (this container):** `cmake --build --preset debug --target slangc slang-test` FAILS near the end — `slang-rhi` (the GPU render-hardware-interface, pulled in by the `slang-test` target) compiles Vulkan headers that `#include <X11/Xlib.h>`, which isn't installed. Error: `vulkan_headers-src/include/vulkan/vulkan.h: fatal error: X11/Xlib.h: No such file or directory`. Installing X11 headers needs an admin-approved image rebuild + container restart (disruptive — kills running reviewers). **Don't.** Instead build **`--target slangc` only** — `slangc` does NOT depend on `slang-rhi`, builds cleanly, and is fully sufficient for text-target emit/FileCheck verification (HLSL/CUDA/Metal/GLSL/SPIR-V-asm). You lose only GPU test *execution* (not needed for emit checks). Most objects compile before slang-rhi fails, so the slangc-only retarget finishes fast.

**Workflow:** use a git worktree so you don't disturb the reviewers' `master` checkout: `git fetch origin pull/<N>/head:pr-<N>; git worktree add ../slang-pr<N> pr-<N>; git submodule update --init --recursive`. Confirm `slangc -v` shows the PR head SHA. Then run each test file's `//TEST:` directive command yourself and trace the FileCheck captures by hand against the emit.

**Subagent caveat:** a build-verify subagent delegated to "build + verify" can return PREMATURELY — it set up a Monitor/wait-loop on the background build and ended its turn reporting "build is progressing" without doing the verification. The nohup'd build survived and finished on its own, but the verification didn't happen. Trust-but-verify: check the worktree/binary state on disk and do the emit comparison yourself rather than assuming the subagent's "done" means done.

**Worth-knowing FileCheck subtlety (coverage wave-aggregate PR #11511):** Metal/CUDA emit the slang helper name `WaveActiveCountBits_0` at the *call site* (`uint _S6 = WaveActiveCountBits_0(...)`), and the increment is the real lowered idiom *inside* that helper (`simd_ballot`/`popcount` on Metal, `__popc(__ballot_sync)` on CUDA). A CHECK `[[CNT:_S[0-9]+]] = WaveActiveCountBits` correctly binds the call-site value to the atomic (the func-definition line has no `_S# =` prefix so it isn't matched) — but it's only meaningful when paired with independent `-DAG` asserts on the real lowered idioms, which is how the fixed test pins it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780940929433-verifying-slang-pr-emit-locally-build-slangc-only-.md`_
