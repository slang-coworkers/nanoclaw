---
name: project_11999_gpu_printing_reenable_parked
description: "#11999 re-enable gpu-printing macOS test — the real fix was a Slang codegen bug (downstream metallib compile hardcoded -std=metal3.1), NOT runner-health. Fixed + merged via PR #12009 2026-07-15; issue stays OPEN (Addresses, not Closes)."
metadata:
  node_type: memory
  type: project
  originSessionId: a257d1cf-f1e8-4611-904f-073f92b7d3cf
---

# #11999 — re-enable gpu-printing example test on hosted macOS

**Terminal (positive).** Bot-filed tracking issue (2026-07-08) to re-enable the
`gpu-printing` example quarantined in #11995 on new hosted macOS aarch64 runners.
The bot's initial root cause was "runner-health, not a Slang bug"; maintainer
**jkwak-work** disputed it ("the example is simple and shouldn't fail whatever the
OS") — and jkwak was right.

## Root cause (the durable fact)
Slang's SPIR-V/metal **emit** honored the `metallib_4_0` capability and emitted the
metal-4.0-only `[[required_threads_per_threadgroup(32,1,1)]]` attribute, but the
**downstream metallib compile hardcoded `-std=metal3.1`** → macOS-26's metal
compiler rejected the 4.0 attribute → `gpu-printing` exited 255 with no output.
**A Slang compiler bug, not runner-health #11973.** macOS-26 runners genuinely
support Metal 4.0.

## Fix (shipped in PR #12009, merged 2026-07-15, merge commit `a2596654`)
Three parts:
1. **Instrument** the 4 silent `SLANG_FAIL` sites in gpu-printing + a slang-rhi
   validation callback — this surfaced the mechanism.
2. **Fix** (`aba3cd7d`): derive downstream `-std=metalX.Y` from the target's
   requested metallib capability instead of hardcoding `-std=metal3.1`.
3. **Revert** #11995's `expected-example-failure-github.txt` quarantine line
   (re-enable the example on hosted macOS).

**#11999 itself stays OPEN** — the PR said `Addresses #11999`, not `Closes`, so
no auto-close; whether to close the tracking issue is a maintainer call (the bot
does not nudge issues closed — [[feedback_github_writes_operator_authorized]]).

## Design point settled (profile vs capability)
jkwak asked whether a user setting a metal-4.0 profile could bypass the fix's
`getTargetCaps().implies(metallib_4_0)` gate. Answer (Main-verified at source):
**no.** `slang-target.cpp getTargetCaps()` folds the profile's capabilities into
the same set the gate reads, and `slang-profile-defs.h` has **no metal 3.x/4.0
profile** (Metal profiles cap at `metallib_2_4`). The gate sits at the right
layer; SPIR-V's `determineSpirvVersion` uses the same capability-driven shape.

## Lesson (durable)
The shadow-mode PR approver ABSTAIN'd correctly ("CI red, human must look") but
**attributed the failure to the runner-health #11973 flake — the comfortable
environmental prior — when the specialist fixer's source-read root cause (a
Slang-internal `-std` hardcode) was correct.** Right verdict, wrong attribution.
See [[feedback_control_the_instrument_not_the_reasoning]].

## Cross-links
- [[project_11985_macos_metal_capability_regression]] — the macOS-26 metal
  capability reconciliation arc this fix pays off; separately triager-owned,
  gated on reverting #12075 (unaffected by this merge).
