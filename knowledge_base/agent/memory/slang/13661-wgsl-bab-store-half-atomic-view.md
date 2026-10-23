---
type: chain
title: slang#13661 — WGSL RWByteAddressBuffer Store<half> rejected; needs an atomic view
description: "albertrodriguezclo, human-filed design question: WGSL BAB sub-word stores. Reporter owns all fix paths: #13647 loads MERGED 10-21, #13852 aligned half2/half4 stores (no review), #13735 option (c) diagnostic (re-review requested after jkwak-work CHANGES_REQUESTED). 10-22 re-check: nothing for the bot; awaiting jkwak-work."
---

# slang#13661

**2026-10-15 16:51Z, webhook `issue_opened`.** Live read before dispatching: OPEN, 0 comments, no labels, no
assignee, human-filed by albertrodriguezclo, body = payload. The only session on
`gh-issue-shader-slang/slang-13661` was this Main webhook session. This is the store-direction follow-up
to [#13634](13634-wgsl-bab-load-half-int16.md) and the reporter's PR #13647, which covers loads only.
Dispatched to `slang-triager`. The brief said the triager may recommend but must not say which option is
*accepted*, and must not hand off to the fixer until a maintainer chooses ((c) alone counts as uncontroversial).

**17:15Z, triaged** ([cmt 6197941951](https://github.com/shader-slang/slang/issues/13661#issuecomment-6197941951);
verified live: nv-slang-bot, `reproduced` label, Type unset on purpose, and the comment stays within the boundary.
Memo: `/workspace/inbox/a2a-1792084631646-l4h070/triage-13661.md`). Enhancement/design · medium · P2 · BAB legalizer → WGSL emit.
The triager reports:
- `Store<half>` gives E56103 with no source location, BAB `Interlocked*` gives E36107, and `Store<uint8_t>` hits an ICE.
- The legalizer's sub-word store (:1760-1800) is already a plain RMW.
- `Interlocked*` requires `cuda_glsl_hlsl_metal_spirv` (hlsl.meta.slang:7611), and the docs say that is by design.
- The WGSL spec has 8-bit memory locations, so (b) is a data race by spec. It also forbids aliasing a group+binding, so (a) must retype the buffer rather than alias it.
- Costs: (a) is the largest and revisits csyonghe's #5220 position. (b) is 30-40 lines plus public option API. (c) is about 15 lines.
- Non-binding recommendation: (c) on its own merits. Of the lowerings, only (a) keeps the 2-byte store guarantee.

No fixer handoff. The timer is the triager's one-shot `i13661-recheck-6b22` for 10-22 17:00Z. I verified
it through its session `sess-1792084552959-6927pu` on `system:tasks:i13661-recheck-6b22`, because
`ncl tasks get` from Main cannot see a peer's tasks.

**Side findings the triager raised (17:17Z):**
1. **#13634 scope overlap.** The triager's #13634 fixer brief listed `Store<half/half2/half4>` among the
   acceptance criteria. I verified this in the fixer session's seq 4. That amounts to option (b) shipped
   without an opt-in. I relayed it to the triager on the #13634 thread, since the triager is the fixer's
   parent; see the #13634 record.
2. **Metal scalar sub-word BAB store skips legalization** (:198-220). The emitter writes a whole-word
   `as_type<uint32_t>(half)`, which clobbers the neighbouring half. The claim that this is also invalid MSL
   is a HYPOTHESIS, because the triager could not compile it for Metal. It is noted in the public comment
   but not filed. Whether to file it is the operator's call.

**Resumes on:** a maintainer comment choosing a direction (arrives by webhook), the 10-22 re-check, or the
operator's call on the Metal finding.

**2026-10-19 16:05Z, maintainer pickup (no comment).** jkwak-work labelled the issue `WebGPU`, assigned it to himself and set the milestone to Q4 2026 (Fall). He has not chosen a direction.

**2026-10-20 12:49Z, reporter comment** ([6291217101](https://github.com/shader-slang/slang/issues/13661#issuecomment-6291217101), read live, unedited). albertrodriguezclo proposes option **(d)**: WGSL's draft `buffer_view` feature (`var<storage> b : buffer` + `*bufferView<f16>(&b, off)`), so a real 16-bit store needs no RMW or atomics. His caveats: the offset must match the view type's alignment (Tint masks a misaligned one), views can't hold atomics, it isn't in Firefox/Safari (naga 25), and so it would be opt-in like #13641. He also suggests the (c) diagnostic could mention it. The claim that "Tint accepts it / Dawn c943ea32" is his and we haven't verified it.
- Arrived as `github.pr_mention`, but the body has no @nv-slang-bot. Its only `@`s are WGSL attributes. It is a human comment on a bot-touched thread, delivered as a live inbound, like the #13631 reporter comment on 10-15. It is addressed to maintainers and asks the bot nothing. **I held: no dispatch and no bot post** (rule in [feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](../imported/feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md) §#13411). The triager's one-shot `i13661-recheck-6b22` (10-22 17:00Z, session 6927pu) reads live state, so it will see both events.

**Resumes on:** jkwak-work choosing (a)/(b)/(c)/(d), or the 10-22 re-check.

**Missed on 10-20, found 10-21: PR #13735** (albertrodriguezclo, 10-17, `fix/wgsl-byte-address-subword-store-diagnostic`, assigned jkwak-work + reporter, reviewer dshreiner-nv). It implements option (c), the located diagnostic, and says it "does not choose a lowering". Fork CI is `action_required`. The CI babysitter had logged it as no-ci, but no chain record linked it to #13661.

**2026-10-21 07:48Z, reporter design note** ([6310877207](https://github.com/shader-slang/slang/issues/13661#issuecomment-6310877207), read live, no bot mention). The reporter's plan:
- (1) Aligned pair case now: `half2`/`half4` at an offset provably a multiple of 4, as whole `bitcast<u32>(vec2<f16>)` word stores. The offset counts as proven for constants, `Store(off, v, 4)`, `StoreAligned` and struct fields. He has a local Vulkan runtime prototype and will open it as his own PR after #13647 merges.
- (2) Scalar or unaligned stores keep #13735's error.
- (3) Revisit those later with `buffer_view` or an atomic view.

He says DXC, SPIRV-Cross, Tint and naga don't emulate 16-bit stores either; I haven't checked that. He will file the Metal finding himself after a macOS compile, which settles the open "operator's call on Metal" item: we don't file it.
- So the reporter owns every fix path, and the bot has nothing to do.
- I amended the triager's re-check (msg 145 → h8d820 on the canonical thread): it reports to me only, makes no GitHub post and no fixer handoff, and leaves Metal unfiled. The triager confirmed the task prompt was updated (msg 150, 07:51Z). A bot-work ask from a maintainer comes to me first.

**Resumes on:** a maintainer acting on #13735, #13647 or the plan; the reporter's aligned-pair PR; or the 10-22 re-check report.

**2026-10-21 21:37Z:** #13647 (loads) merged, and #13634 closed as completed.

**2026-10-22 02:42Z: reporter opened PR #13852** (`fix/wgsl-bab-store-half`, non-draft, assigned jkwak-work + reporter, reviewer dshreiner-nv). It does part (1) of the plan: aligned `half2`/`half4` stored as whole words. Scalar and 2-byte-aligned stores are still rejected. He announced it in [6331387615](https://github.com/shader-slang/slang/issues/13661#issuecomment-6331387615), addressed to @jkwak-work ("feel free to close it"); read live, no bot mention.
- Held: no dispatch and no bot post. The reporter owns the fix path; #13735 (diagnostic) and #13852 are both waiting on jkwak-work. The approvers are still paused, so I won't route any `pr_ready_for_review` for #13852.

**Resumes on:** jkwak-work acting on #13735 or #13852, or the 10-22 17:00Z re-check report (report-only).

**2026-10-22 17:02Z, re-check `i13661-recheck-6b22` reported (triager, report-only, as amended).** I verified it live at 17:05Z:
- #13647 merged on 10-21 at 21:37Z.
- #13852 (aligned `half2`/`half4` stores as whole words; head 20353c3fd) is OPEN and non-draft. It has **no reviews**.
- #13735 (option (c); head 6b97201ba) is OPEN with CHANGES_REQUESTED from jkwak-work, 10-21 23:57Z, against 867cef869. He asked that the option hold a minimum store size rather than a hard-coded 4. The reporter addressed this in 6b97201ba (`minimumStoreScalarSize`) and asked for a re-review in 6341546299, 10-22 13:08Z.
- The issue is unchanged: OPEN, 4 comments, all from the reporter, and no maintainer direction.
- The bot's #13647 cmt 6311604086 (10-21 08:30Z) told jkwak-work that #13661 already tracks `Store<half>`, so no duplicate was filed. It has no reply. The #13647 re-check t-74f064 (10-23) covers it.
- Nothing for the bot to do: no post, no fixer handoff, and Metal stays unfiled (the reporter owns it). There is no new #13661 one-shot. The timer is its `/supervise-issues` register entry (`awaiting_human`).

**Resumes on:** jkwak-work re-reviewing #13735 or reviewing #13852 (arrives by webhook). Don't route a `pr_ready_for_review` for either PR while the approvers are paused.
