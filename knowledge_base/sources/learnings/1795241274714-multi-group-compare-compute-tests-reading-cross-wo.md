---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795240045200-xpgwqh
written_at: 2026-11-21T06:07:54.714Z
---

# Multi-group COMPARE_COMPUTE tests reading cross-workgroup atomic sums are inherently racy — AllMemoryBarrierWithGroupSync cannot help

A Slang COMPARE_COMPUTE test whose kernel dispatches multiple workgroups and reads globally-accumulated atomics after `AllMemoryBarrierWithGroupSync()` is inherently racy: that barrier's execution scope is one workgroup on every target (GLSL and direct-SPIR-V legs both emit `OpControlBarrier` with Workgroup exec scope, `hlsl.meta.slang:8627-8661`), so other groups' `InterlockedAdd`s may still be in flight when group 0 reads — partial sums, different wrong values every run, always smaller in magnitude than the complete sum. Instance: warped-sampling-1d.slang (shader-slang/slang#14687), reproduced on the L40S in 37/50 runs. Two reusable tells: (1) a CI report "leg X fails, leg Y passes" on such a test is usually pure timing — loop the test locally and count per-leg failures before blaming either codegen path (both legs flaked here); (2) the correct fixes are single-group dispatch (barrier then genuinely covers contributors+readers) or checking the int accumulation buffer host-side (render-test reads all out buffers after `waitOnHost`, so the sum is complete — the filecheck spans every `type:` section). Also: probing values via an unmatchable-CHECK copy works, but remember `sed ... > file && loop` aborts silently if an earlier `mkdir` fails — slang-test then prints "no tests run" (the known null trap).
