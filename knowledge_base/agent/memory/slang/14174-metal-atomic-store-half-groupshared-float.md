---
type: chain
title: slang#14174 — Metal: `Atomic<T>.store` on `half`, or on `float` in groupshared memory, emits atomics MSL lacks
description: BOT-filed by slang-fixer 2026-11-02 11:49Z as a side finding of the #14153 fix (filing policy, no go-ahead needed). FILED-ONLY, fan-out held. The issue_opened webhook needs NO dispatch; the filing fixer is on the #14153 chain.
tags: [metal, emit, atomics, float, half, bot-filed, filed-only]
---

# slang#14174 — Metal: `Atomic<T>.store` on `half`, or on `float` in groupshared memory, emits atomics MSL lacks

**Origin.** slang-fixer `sess-1793614762821-zcmuu7` (thread `gh-issue-shader-slang/slang-14153`) found this while fixing
[#14153](14153-metal-float-texture-atomic-add.md). Its report is msg 56, 11:50Z. It filed the issue under
[the filing policy](../orchestrator/filing-verified-issues-policy.md), reproduced on master 6815ed82d (Debug), deduped,
with the body passed by codex OUTPUT_REVIEW. I checked live at 11:51Z: author `app/nv-slang-bot`, no labels, no #14153
reference, no @-mentions, no Fixes link. That is R6-clean for #14153.

**Finding (the fixer's).** `Atomic<half>.store` has no `atomic<half>` in MSL (§2.6). `groupshared Atomic<float>.store`: atomic_float is device-only (§6.16.4.1). Both exit 0. Device float store is valid and is out of scope. Texture float store was not filed: no user-visible source produces `AtomicStore` on a texel. And/Or/Xor are left to [#14162](14162-float-bitwise-interlocked-ops.md). Apple's compiler was not run; the issue cites the spec instead.

**State: filed-only, fan-out held (my call 11:51Z).** No fixer chain. The `issue_opened` webhook needs no dispatch;
a sibling Main session was handling it at 11:49Z. Starting a fixer chain is a fan-out to report to the operator first.

**11:52Z webhook handling (Main `sess-1793620186758-hqrskg`, thread `gh-issue-shader-slang/slang-14174`).** No triager or
fixer dispatched. I reproduced it on Release slangc at 6815ed82d: exit 0, emits `atomic<half> device*`,
`atomic<float> threadgroup*` and `atomic_store_explicit` on both (lines 22-23 of the MSL). Cause verified: in
`slang-emit-metal.cpp` the `kIROp_AtomicStore` case (~:519) has no float check, while Load/Exchange/CAS call
`diagnoseFloatAtomic`. Live: Type is unset (the fixer set none; #14162 got Type=Bug). The natural fix is one call to
[#14060](14060-metal-float-atomic-load-exchange-cas.md)'s `getUnsupportedFloatAtomicReason` from AtomicStore, so it would
stack on #14060 (draft PR opens 11-02 22:05Z), like #14153 does. Bot-filed, so no R6 hold.
**Parked on an operator decision:** open a fixer chain, fold into #14153's stack, or leave it. Asked on
orchestrator-dashboard 11:52Z (thread `gh-issue-shader-slang/slang-14174`). Timer: one-shot `recheck-14174-operator-4575`
(11-04 12:00Z).

**11-02 12:28Z edit (fixer msg 92).** Retitled "Metal: `half` atomics and `groupshared` `float` store emit atomics that MSL does not have". The body adds `Atomic<half>.add`/`.sub` and `InterlockedAdd` on half buffer and groupshared targets, reproduced on 6815ed82d (exit 0, `atomic_half`). This half residual is not covered by human PR #14170. I verified it live; it is still R6-clean.
