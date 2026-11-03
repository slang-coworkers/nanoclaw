---
type: chain
title: slang#14162 — InterlockedAnd/Or/Xor accept float and emit code every backend rejects
description: BOT-filed by slang-triager 2026-11-02 10:23:10Z as a side finding of the #14153 triage (filing policy, no go-ahead needed). FILED-ONLY, fan-out held. The issue_opened webhook for it needs NO dispatch, because the triager that filed it already owns it.
tags: [atomics, core-module, float, bot-filed, filed-only]
---

# slang#14162 — float `InterlockedAnd/Or/Xor` accepted on every target

**Origin.** slang-triager (`sess-1793614086392-h2h06c`, thread `gh-issue-shader-slang/slang-14153`) found this
while triaging [#14153](14153-metal-float-texture-atomic-add.md). Its report is msg 44, 10:23Z. It filed the issue
under [the filing policy](../orchestrator/filing-verified-issues-policy.md). I checked live at 10:24Z: author
`app/nv-slang-bot`, Type=Bug, no labels, no #14153 reference, no @-mentions, no Fixes link. That is R6-clean for #14153.

**Finding (the triager's).** Reproduced on 6815ed82d. The `slangAtomicOperationInfo` table in hlsl.meta.slang
(~12757) constrains And/Or/Xor on `IArithmeticAtomicable` and not on `IBitAtomicable`, so float, half and double are
accepted. Results by target:
- Metal: emits `atomic_fetch_and_explicit` on `atomic_float`.
- DXC, glslang and NVRTC: reject the output.
- Direct SPIR-V: fails spirv-val (E99999).
- WGSL and CPU: already give E36107.
`Atomic<float>.and` is already E30027. The fix is a one-line constraint change, suggested in the issue. No working shader breaks.
Dedupe: nearest is #14026 (float min/max; PRs #14046–#14048 don't touch And/Or/Xor).

**State: filed-only, fan-out held (my call 10:24Z).** No fixer chain. The `issue_opened` webhook needs no
dispatch, and a sibling Main session (`sess-1793614992685-uorlm9`) was handling it at 10:23Z. Starting a fixer chain
is a fan-out to report to the operator first.

**10:26Z webhook handling (Main `uorlm9`, thread `gh-issue-shader-slang/slang-14162`).** No triager or fixer dispatched.
I verified the cause at 6815ed82d: hlsl.meta.slang:12757-12765 gives And/Or/Xor `IArithmeticAtomicable`, and
core.meta.slang:4165-4173 has float/half/double conform only to `IArithmeticAtomicable` (`IBitAtomicable` = int/uint/int64/uint64).
This is also follow-up #1 of [#14026](../imported/project_14026_float_atomic_min_max_cuda_glsl_hlsl.md) (held 10-29 for fan-out control).
Overlap: #14153's fixer edits the stale `@remarks` text (~12775-12785) in the same template block. The hunks are about 15 lines apart, so the conflict risk is low.
**Parked on an operator decision:** whether to open a fixer chain. I asked on orchestrator-dashboard at 10:26Z.
Timer: one-shot `recheck-14162-operator-da12` (11-04 10:30Z). The issue is bot-filed, so no R6 hold applies.
