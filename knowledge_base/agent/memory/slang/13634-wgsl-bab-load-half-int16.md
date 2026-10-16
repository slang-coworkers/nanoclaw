---
type: chain
title: slang#13634 — WGSL ByteAddressBuffer Load<half> fails with E56103
description: "albertrodriguezclo, human-filed bug: WGSL plain BAB Load<half> (and structs with half fields) fails with E56103 '16-bit integers not supported in WGSL' with no source location; StructuredBuffer<half> works. Triaged 10-15 13:42Z (P2, cmt 6193510990). Reporter fixed it in own PR #13647; our fixer stood down. Gap 1 (PR review nit) + gaps 2/3 (separate issues) await operator call; re-check rechase-13634-pr13647-297e 10-16 18:00Z."
---

# slang#13634

**2026-10-15 13:1xZ, webhook `issue_opened`.** Live read before dispatching: OPEN, 0 comments, no
labels, no assignee, human-filed by albertrodriguezclo (one of a 12-issue batch #13631–#13642 filed
13:15:34–49Z), `updated_at` = `created_at`, body matches payload. The only session on
`gh-issue-shader-slang/slang-13634` was this Main webhook session. `gh search` found no open
duplicate; #11835 (closed, "WebGPU / WGSL backend is missing 16-bit float support") is related.

Orchestrator pointer (unverified, master 6597ec9202): WGSL sets `lowerBasicTypeOps` +
`useBitCastFromUInt` (`slang-emit.cpp:2268-2275`). In `emitSimpleLoad`
(`slang-ir-byte-address-legalize.cpp:817`), the `size < 4` branch loads the aligned u32, shifts and
masks, then `emitCast(getUInt16Type())` → `emitBitCast(half)` (~:984-990). The WGSL emitter rejects
`kIROp_UInt16Type` via `diagnoseOnce(Int16NotSupportedInWgsl)` (`slang-emit-wgsl.cpp:556-559`,
also :1082-1087), with no source loc. The u16 intermediate is the problem, not half itself.

Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13634`.

**13:19Z, triager progress (msg 16):** reproduced on a local build; scalar, vector and `Store` forms all fail. Tracing legalizer/emitter. Not a completion report.

**13:25Z, triager progress (msg 18):** reproduces on v2026.19 and master; legalizer half→UInt16 confirmed at two sites. Checking emitter + diagnostic loc. Still not a completion report.

**13:26Z (msg 20):** emitter + no-loc diagnostic confirmed; checking whether the reporter's `bit_cast`/`f16tof32` workaround also trips E56103.

**13:42Z, [Triage] (msg 22, memo `/workspace/inbox/a2a-1792071766781-zxz3qv/triage-13634.md`):** bug / medium / P2,
IR (BAB legalize + lowerBitCast) → WGSL. All four Orchestrator pointers confirmed. Second producer found:
`lowerBitCast` `readObject` maps Half → UInt16 (`slang-ir-lower-bit-cast.cpp:172-179`; Main spot-checked), and its same-size
fast path (:280) is `isDirectSpirv`-only, so `bit_cast<half2>(uint)` fails on WGSL too. Related open #10207 (bool analogue).
Approach A (recommended): native `vec2<f16>`↔`u32` bitcasts in both producers, no u16 on WGSL. Posted
issuecomment-6193510990 (verified: bot, 13:42:11Z); `reproduced` label verified. Handed to slang-fixer: session
`sess-1792071659345-5x3z36` on the canonical thread (verified running), worktree wt-slang-13634.

**17:31Z, triager progress (msg 30):** the reporter opened their own PR **#13647** (albertrodriguezclo, 14:03Z, non-draft,
head `4b50379bb1`, "Fixes #13634", adds `loadHalfFrom32BitWords` BAB option for WGSL; Main verified via `gh pr view`). Our fixer
paused with nothing pushed and no PR, and reported three claimed gaps in #13647. The triager is checking them against a local build
of #13647, then deciding on stand-down and sending the 5-bullet. Not a completion report.

**17:38Z (msg 32):** #13647 @4b50379bb passes every load criterion in the triager's local build. **The fixer has stood down.** The triager
confirmed 2 of the fixer's 3 gaps; gap 1 holds on the spec. It is now checking for a collision with **#13661** (albertrodriguezclo, 16:51Z,
"`RWByteAddressBuffer.Store<half>` is rejected; needs an atomic view", the Store half of this bug, filed separately). #13661 is owned by
its own triager session `sess-1792083175842-h8d820` and a sibling Main `sess-1792083069249-sec6z5` (Main verified both running). The 5-bullet is still pending.

**17:41Z (msg 36):** the triager says it holds #13634 ownership. Gaps 2 and 3 are confirmed on the #13647 build and also fail on master. Gap 1 holds on the spec; a runtime check is in progress. The 5-bullet is still pending.

**17:49Z, [Report] (msg 38/40):** all three of the fixer's gaps checked against #13647 @4b50379bb, with base wt-13648 @28f3cd426 as control.
The fixer has stood down and never pushed; its archive is `patches/fix-13634.patch`. Comment 6193510990 is unchanged and no GitHub post was made.
- **Gap 1 (review input for #13647):** the PR's `emitHalfLoadFrom32BitWord` returns element 0 of `bitcast<vec2<f16>>(word >> shift)` without
  masking. Main read the PR diff and confirmed there is no `emitBitAnd`. At offset%4==0, the high half is the neighbour, and under WGSL's
  finite-math assumption an Inf/NaN neighbour makes the result indeterminate. Spec grounds only; there is no GPU to observe it. The fix is one mask.
- **Gap 2 (separate issue, or fold into #13647):** `bit_cast` to or from a struct with half fields gives E56103 on both base and PR. Producers are
  `slang-ir-lower-bit-cast.cpp:172-179` and `slang-ir-extract-value-from-type.cpp:36`.
- **Gap 3 (separate issue):** any-value marshalling of a conformer with half fields (`StructuredBuffer<IFoo>`) gives E56103, at
  `slang-ir-any-value-marshalling.cpp:423-433` and `:971-1002`.
- No existing issue covers gaps 2 or 3. Main searched, and the reporter's newer issues are #13643–#13666; #13661 is the Store half.
- #13647 live state at 17:50Z: OPEN, non-draft, no labels, reviews only from coderabbit and the author, CLA signed.
**Operator asked once (~17:55Z):** whether to post gap 1 on #13647 and whether to file gaps 2 and 3. The one-shot
`rechase-13634-pr13647-297e` (10-16 18:00Z) holds the decision table.

**Resumes on:** operator answer, #13647 webhooks (review/merge), a human comment on #13634, or the 10-16 one-shot.

**2026-10-15 17:2xZ, scope overlap and a stall (found while routing #13661).**
- The reporter's PR #13647 (`fix/wgsl-bab-load-half`, 14:03Z, `Fixes #13634`, non-draft, shepherd jkwak-work, reviewer dshreiner-nv) implements approach A for loads, covering both producers. Its description says stores are deliberately left out.
- The fixer brief (seq 4) lists `Store<half/half2/half4>` in its acceptance criteria. That is a plain RMW, which is option (b) of [#13661](13661-wgsl-bab-store-half-atomic-view.md), shipped with no opt-in.
- The fixer session `sess-1792071659345-5x3z36` has been silent since 13:42Z ("Building now, ETA ~25 min"). There is no `fix/issue-13634` branch upstream and no bot PR.
- Relayed to slang-triager on this thread (it is the fixer's parent). The ask: drop stores from the acceptance criteria pending #13661, check #13647 against approach A and stand the fixer down unless something material is missing (the #13635/#13639 precedent), and report the fixer's real state.

**Resumes on:** the triager's report on this thread.

**17:24Z, triager ack (msg 32), progress only.** It sent the fixer a [Scope change] (msg 29): pause, drop stores, report state, likely stand down. It is building #13647 @4b50379bb to check it against the approach-A load criteria. Static read so far: it matches A for loads. The only gap is that the test is compile-only FileCheck with no runtime `-wgpu` check. The 5-bullet comes after the build and the fixer's reply.

**17:29–17:40Z, a split-brain inside the triager, now reconciled.**
- My 17:20Z relay carried `thread_id=…-13634` but no pin. It landed in the triager's **#13661** session (h8d820), which then drove #13634: [Scope change] msg 29, [Stand down] msg 35, an in-place patch of cmt 6193510990 at 17:32:59Z, and a [Report] to me saying "#13647 covers the fix".
- The fixer's replies went to the **canonical** triager session `sess-1792070303836-fneziu`:
  - seq 8, 17:29Z, paused report: 6 local commits, store hunk in 2a3945c149.
  - seq 12, 17:33:59Z, [Fix] stood down: never pushed, archived `patches/fix-13634.patch`, store hunk dropped.
- The fixer claims three gaps in #13647 that h8d820 never saw:
  1. Unmasked neighbouring half before `bitcast<vec2<f16>>`, which is indeterminate for NaN/Inf under WGSL finite-math.
  2. Struct `bit_cast` with half fields still goes through u16 (readObject/bitCastLeafValue).
  3. Any-value marshalling of half gives E56103.
- fneziu at 17:38Z (seq 25, progress): #13647 passes every load criterion; 2 of the 3 gaps are confirmed and gap 1 holds on the spec.
- Fix: `[Ownership]` pinned to fneziu. My first send (id 61, pin + thread_id) landed in h8d820, because the auto-stamped `in_reply_to` outranks the pin ([feedback_in_reply_to_beats_target_session_id_pin](../imported/feedback_in_reply_to_beats_target_session_id_pin.md)). The re-send with `in_reply_to=2` (my webhook row) plus the pin landed as fneziu seq 16 at 17:39:49Z.
- h8d820 has stood down on #13634 (msg 88). Its handover is `memory/issues/13634.md` "Handover 17:4xZ", and it gave `wt-13647` plus `pr13647-review` cleanup to fneziu.

**Resumes on:** fneziu's 5-bullet, with a per-gap verdict marked "review input vs separate issue" and any in-place correction of cmt 6193510990. After that, the operator decides whether anything goes to #13647 or gets filed.
