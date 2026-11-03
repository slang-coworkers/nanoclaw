---
type: chain
title: slang#14175 — Metal: groupshared float atomic add/sub needs MSL 4.1, but Slang compiles for metal3.1 with no diagnostic
description: BOT-filed by slang-fixer 2026-11-02 11:49Z as a side finding of the #14153 fix (filing policy, no go-ahead needed). FILED-ONLY, fan-out held. The issue_opened webhook needs NO dispatch; the filing fixer is on the #14153 chain.
tags: [metal, atomics, float, groupshared, msl-version, capability, bot-filed, filed-only]
---

# slang#14175 — Metal: groupshared float atomic add/sub needs MSL 4.1, but Slang compiles for metal3.1 with no diagnostic

**Origin.** slang-fixer `sess-1793614762821-zcmuu7` (thread `gh-issue-shader-slang/slang-14153`) found this while fixing
[#14153](14153-metal-float-texture-atomic-add.md). Its report is msg 56, 11:50Z. It filed the issue under
[the filing policy](../orchestrator/filing-verified-issues-policy.md), reproduced on master 6815ed82d (Debug), deduped,
with the body passed by codex OUTPUT_REVIEW. I checked live at 11:51Z: author `app/nv-slang-bot`, no labels, no #14153
reference, no @-mentions, no Fixes link. That is R6-clean for #14153.

**Finding (the fixer's).** `InterlockedAdd` and `Atomic<float>.add`/`.sub` on groupshared memory need MSL 4.1 (§6.16.4.5). Slang emits them with no diagnostic and passes `-std=metal3.1` by default (`metal4.0` with `metallib_4_0`). No capability selects 4.1. Apple's compiler was not run; the issue cites the spec. Note: #14153's fix deliberately leaves groupshared add/sub as it is (R4).

**State: filed-only, fan-out held (my call 11:51Z).** No fixer chain. The `issue_opened` webhook needs no dispatch;
a sibling Main session was handling it at 11:49Z. Starting a fixer chain is a fan-out to report to the operator first.

**11:5xZ webhook handling (Main `gidghv`, thread `gh-issue-shader-slang/slang-14175`).** No dispatch, which agrees with the record above.
I verified the issue's code citations at 6815ed82d: `slang-gcc-compiler-util.cpp:987` adds the default `-std=metal3.1`;
`slang-code-gen.cpp:774-788` sets 4.0 only for `metallib_4_0` and otherwise uses the version from `MetalExtensionTracker`;
the only `requireMetalLanguageVersion` caller is `slang-emit-metal.cpp:962` (3.2). Nothing requests 4.1. Live: 0 comments, no labels.
**Interaction to carry into any fix:** #14153's R4 test pins groupshared float add/sub as *compiling* on Metal, and #14153's
helper passes them explicitly. A #14175 fix (E55204 below 4.1, or requesting 4.1) must update that test. The #14153 PR
description can name #14175 as the known gap; #14175 is bot-filed, so no R6 hold applies to it.
The operator fan-out question belongs to the #14153 Main session (`q42tdv`), which received the fixer's report. This session does not ask it again.
