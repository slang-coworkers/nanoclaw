---
type: chain
title: slang#14162 — InterlockedAnd/Or/Xor accept float and emit code every backend rejects
description: BOT-filed by slang-triager 2026-11-02 10:23:10Z as a side finding of the #14153 triage. MAINTAINER-OWNED since 11-02 18:37Z (jkwak-work self-assigned, milestone Q1 2027). Fixer go/no-go withdrawn 11-04. No bot work; resumes only on an @nv-slang-bot mention or an operator ask.
tags: [atomics, core-module, float, bot-filed, filed-only, maintainer-owned]
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

**11-04 10:30Z re-check (one-shot `recheck-14162-operator-da12`): MAINTAINER-OWNED, ask withdrawn.**
- **Operator:** no reply. I searched the dashboard from the 11-02 10:27Z ask (row 510006) to 11-04 10:30Z (row 510758). No row mentions 14162 after the ask.
- **GitHub:** open, 0 comments, 0 labels, no linked PR (`gh pr list --search 14162` returns `[]`). Timeline: jkwak-work **assigned themself at 11-02 18:37:17Z** and set **milestone Q1 2027 (Winter)** at 18:37:27Z. That is the same pattern, the same minute, as #14181, and as #14143. In both of those I withdrew the fixer go/no-go.
- **Action:** I sent one withdrawal note to orchestrator-dashboard. I did not send a re-ask. No dispatch, no GitHub writes, no new timer.
- **Resumes on:** an @nv-slang-bot mention on #14162, or an operator ask. If it does resume, the spec is still the one-line `IArithmeticAtomicable`→`IBitAtomicable` change (hlsl.meta.slang ~12757) plus a DIAGNOSTIC_TEST, on thread `gh-issue-shader-slang/slang-14162`.

**11-05 11:35Z operator triage ask (dashboard msg 54) → verdict given by Main inline, no dispatch.**
Re-verified on master `04d2726db` (11-05): the table, now at hlsl.meta.slang:12803-12811, is unchanged; local Release slangc
(built 11-02 22:24Z) reproduces Metal `atomic_fetch_and_explicit` on `atomic_float`, HLSL `InterlockedAnd(…, 1.0f, …)`, and direct
SPIR-V `OpAtomicAnd %float` → E99999. The uint form is clean. Fix-impact check: no test calls And/Or/Xor on a float
(`tests/metal/atomic-texture-buffer.slang -DFLOAT` uses only Exchange). Verdict: bug / core module (Interlocked* constraints) /
low severity / P3 (accepts invalid code; nothing that works today breaks). Next: HOLD, because jkwak-work owns it (assigned, Q1 2027).
No GitHub write, no triager re-run. It resumes on a jkwak-work @nv-slang-bot mention or an explicit operator override.
