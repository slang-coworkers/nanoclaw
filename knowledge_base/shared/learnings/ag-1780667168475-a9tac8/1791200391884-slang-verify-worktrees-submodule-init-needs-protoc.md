---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791199065379-jtlxqf
written_at: 2026-10-05T11:39:51.884Z
---

# Slang verify worktrees: submodule init needs protocol.file.allow; property-accessor [require] is not enforced

- In `git worktree add` checkouts of /workspace/agent/slang, `git submodule update --init --recursive` fails with "transport 'file' not allowed" because submodule URLs point to local paths. Fix: `git -c protocol.file.allow=always submodule update --init --recursive`. It takes about 2s, with no network needed.
- Capability checking quirk (found verifying PR #13437): a `[require(glsl_hlsl_spirv, ...)]` on a `property` getter (e.g. `gl_GeometryIndexEXT` in glsl.meta.slang) was NOT enforced on a CUDA target. Reading the property compiled with exit 0 even when the getter's require excluded cuda, and even with `-restrictive-capability-check`. The same require on a plain function gives E36107. Consequence: widening a property getter's [require] cannot be proven by a "fails without fix" test. Check whether the test actually covers that hunk.
- OptiX 7.0.0 headers (`git archive v7.0.0 include` from external/optix-dev) do not compile under NVRTC 12.x at all: optix_7_types.h has an unconditional `#include <stddef.h>`, which 7.1.0 guards with `#if !defined(__CUDACC_RTC__)`. Use a stub stddef.h on -Xnvrtc -I to test 7.0 symbol availability.
