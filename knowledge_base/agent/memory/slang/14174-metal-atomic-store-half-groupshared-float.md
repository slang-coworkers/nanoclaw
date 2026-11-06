---
type: chain
title: slang#14174 — Metal: `Atomic<T>.store` on `half`, or on `float` in groupshared memory, emits atomics MSL lacks
description: BOT-filed by slang-fixer 2026-11-02 11:49Z (#14153 side finding), widened 12:28Z to half add/sub. Maintainer-held (jkwak-work, Q1 2027). Triaged from live state 11-05 - bug/low/P3 Metal emit; not covered by #14210 or #14170. Operator go/leave still open; no timer.
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

**11-04 12:00Z re-check (`recheck-14174-operator-4575`): no operator answer. Reminder sent once, no new timer.** The
dashboard session (seq 509967–510768, 11-02 08:30Z → 11-04 11:30Z) mentions 14174 only in my 11:52Z ask. Live: OPEN,
no labels, no comments, no PR. On 11-02 18:32Z jkwak-work self-assigned it and set milestone "Q1 2027 (Winter)". That is
routine triage: jkwak-work also holds #14153 (Q4 2026) and #14162 (Q1 2027), so it is no claim to fix. Its dependency
#14060 is now bot draft PR #14210. I sent one reminder to orchestrator-dashboard (thread `gh-issue-shader-slang/slang-14174`,
msg id 9) with the options `go` / `fold` / `leave 14174`. **Parked with no timer.** An operator answer arrives as an
inbound; a `go` needs a slang-fixer session check on the thread first.

**11-05 11:35Z dashboard "New issue to triage" (msg 62, templated).** I answered with a verdict from live state and sent nothing
to the triager, the fixer or GitHub. This follows the #13729/#13757 precedent: a maintainer owns the issue, and the bot-filed body already is the triage.
Live: OPEN, assignee jkwak-work, milestone Q1 2027, 0 comments, no labels, Type unset. I re-ran the widened 7-op repro at 6815ed82d:
exit 0, 7 `atomic_*_explicit`, `atomic<half>`/`atomic_half`. `slang-emit-metal.cpp` was last changed 10-29, so this holds on master
04d2726db. **Coverage of open PRs:** #14210 (the #14060 fix, now ready) moves the float gate into `getUnsupportedMetalFloatAtomicReason`
in `slang-ir-check-unsupported-inst.cpp`, but only for Load/Exchange/CAS/Min/Max. #14170 (the reporter's PR) gates texture float atomics only.
Neither covers Store or half Add/Sub. **Verdict:** bug / low / P3 / Metal target-emit (a missing diagnostic: Apple's compiler fails loudly, and
nothing miscompiles silently). The fix is to add `kIROp_AtomicStore` and half `AtomicAdd`/`AtomicSub` to #14210's helper, after #14210 merges.
The "fold into #14153" option is moot, because the #14153 bot branch was deferred to #14170 and is never pushed. The operator decision is still open, now **go
(stacked on #14210, ask jkwak-work first, since they are the assignee) / leave to jkwak-work**. Parked with no timer.
