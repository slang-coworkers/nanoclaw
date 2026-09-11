---
name: VK_KHR_shader_abort follow-ups — #11528 Gap C (operator-pending) + #11790 runtime test (deferred P2)
description: Two follow-ups to the shipped abort feature (#11542). Gap C = a live one-line emit-token conformance bug awaiting operator go/no-go (default HOLD). #11790 runtime test is terminal/deferred at P2 (impl confirmed working; integration PR #11792 closed unmerged).
type: project
originSessionId: 43bedef2-9dcf-4531-bd2e-53b4b0a47e9b
---
# VK_KHR_shader_abort follow-ups (#11528 Gap C + #11790)

Both stem from the VK_KHR_shader_abort feature shipped via merged PR **#11542** (2026-06-16):
`void abort<each T>(NativeString format, expand each T args)` overloading SM4 `abort()`, lowered to
`kIROp_Abort`, emitted as `OpAbortKHR` (SPIR-V) / `abortEXT` (GLSL). Compiler side already has emit +
diagnostics coverage (`tests/spirv/abort*.slang`, `tests/diagnostics/abort-*.slang`).

## Gap C — emit-token conformance bug — LIVE, on HOLD (operator go/no-go)

Merged `source/slang/slang-emit-spirv.cpp` emits `OpExtension "SPV_KHR_shader_abort"` (the **Vulkan**
name), but the SPIR-V registry token is **`SPV_KHR_abort`** → a module declaring it fails `spirv-val`.
Fix = one-line token change + a FileCheck/spirv-val regression test. Flagged on GitHub (issue comment
4784413276). Operator go/no-go via `ask_user_question` **TIMED OUT 2026-06-23 → defaulted to HOLD**
(issue #11528 is closed/shipped; active author jkwak may self-fix).
**⛔ Do NOT re-dispatch the fixer for Gap C without explicit operator go.** This is the only
independently-live item in this chain.

## #11790 — runtime slang-test for abort — TERMINAL / deferred at P2

- **slang-rhi#782** (the RHI plumbing: VK_KHR_shader_abort + VK_KHR_device_fault enablement, a
  `Feature::ShaderAbort` enum entry, device-fault message retrieval) **MERGED 2026-06-29**
  (`fb908a7c72ef1944b36a386ddc0fa2536fa4445f`).
- **slang#11792** (integration PR: submodule bump to the merged SHA + gated abort runtime test) was
  maintainer-driven to ready+approved, then **jkwak CLOSED it UNMERGED 2026-07-08**: *"Closing for now
  because the issue is deprioritized and we will come back to the test coverage much later."* Stacked PR
  **#11799** (render-test message capture) was folded into #11792 and closed.
- **#11790 stays OPEN** as jkwak's P2 tracking issue. The abort **implementation is confirmed working**
  (jkwak downgraded P0→P2 2026-06-30); only the runtime-test **coverage** is deferred.
- **Revisit trigger jkwak set himself:** a graphics driver that OFFICIALLY (non-Beta) exposes both
  `VK_KHR_shader_abort` and `VK_KHR_device_fault`. As of the chain close, the latest NVIDIA driver
  lacked the extension and the Beta driver had a known bug, so the abort round-trip is un-runnable on any
  accessible box (the box HAS a capable GPU — NVIDIA L40S — the gap was **driver/extension**, not
  hardware). Round-trip validation is jkwak's to run.

**Chain closed on our side — no poller, no pending webhook, no Main/operator action.** Re-opens only on a
fresh substantive non-bot comment / webhook, which arrives as a new dispatch.

## Durable lesson — a stale *inhibitory* gate (from this chain's own history)

This file once carried a "must NOT merge #11792 until #782 lands" gate that stayed inert ~35 days after
#782 merged and after #11792 was closed. Lessons: **resolve the NAMED TRIGGER (here slang-rhi#782), not
the filename**; then **ask whether the gated ARTIFACT still exists** ("trigger fired" ≠ "condition
live"). An inhibitory stale gate is worse than a stale informational note — it **suppresses correct
action and fails toward inaction, which leaves no trace** and is invisible to any check that looks for
wrong output.
