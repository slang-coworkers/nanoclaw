---
type: project
name: project_13823_metal_combined_sampler_handle_anyvalue
description: "PARKED ON MAINTAINER 10-22 01:06Z. slang#13823 (albertrodriguezclo, external): Metal AnyValue packs a combined Sampler2D.Handle into 8 bytes and casts it to and from ulong. Bot draft #13843 (fix/issue-13823@81efc9ddf6, diagnostic-only E41014, fixer sess-1792610420980-0vwcru) passed peer review R2 (APPROVE, 0/0/0) and is HELD as a draft at the reporter\'s request; the reporter\'s 16-byte commit 557906ff6 becomes a PR after #13755 merges. Maintainers pick (shepherd saipraveenb25). Spin-off #13851 (CPU) is owned here. One-shot rechase-13823-maintainer-2329 on 10-28 12:00Z."
---

# slang#13823: Metal combined `Sampler2D.Handle` in an AnyValue

**10-21 18:31:39Z `issue_opened`.** Main webhook session `sess-1792607502755-8epvx9`. Live read at ~18:35Z: open, 0 comments, no labels,
unassigned.

**Origin.** This is a follow-up to [[project_13753_metal_anyvalue_texture_handle_cast]]. Our bot's clarity review on PR #13755
(review cmt 4339120830, 16:12Z) raised the combined-sampler shape. The reporter confirmed it by compiling (reply 4340207200, 18:01Z) and
said real support "belongs in a separate issue". The bot did not ask for the filing, so this is a human report and gets a normal triage.
#13755 is open, not a draft, head 86f2514cd. jkwak-work requested changes 16:05Z ("one minor change"). With #13755 applied, this case
gives a `SLANG_DIAGNOSE_UNEXPECTED` internal error.

**Ownership check.** No other session was on the canonical thread, no task names the issue, and no conversations hit. The 13753 sessions
were stopped since 10-19.

**10-21 ~18:36Z:** dispatched to slang-triager on `gh-issue-shader-slang/slang-13823` (msg 11). The brief:
- check #11540's won't-implement rationale before choosing between 16-byte marshalling and a diagnostic;
- do not repeat the retracted "cannot be written in MSL" claim;
- look for a reporter PR before any fixer handoff.

**10-21 19:20Z [Triage] (triager msg 14; memo copy at /workspace/agent/reports/triage/triage-13823.md):** bug / low / P2, IR dynamic
dispatch + AnyValue, Metal emit. Not new on master: 2026.13.1 gives the same output. Reproduced on master 23f8fbe9b.
- **Cause:** AnyValue sizing and marshalling (emit.cpp:1759, :1821) run before `lowerCombinedTextureSamplers` (:1948), and the IR size
  of a combined handle is 8 (ir-layout.cpp:547). `canTypeBeStored` skips the opaque check on Metal, so E41014 never fires.
  `reinterpret<uint4>(Sampler2D.Handle)` hits the same cast.
- **A (dispatched):** a located E41014 for combined texture-sampler types at the Metal AnyValue producers (closed sets,
  `lowerReinterpret`, open-world). It stays outside slang-emit-metal.*, where jkwak-work asked #13755 to stay.
- **B (16 bytes):** left as a maintainer call. It reverses #11540 and needs an IR stride change and a slang-rhi host producer.
- **C (earlier pass):** rejected.

**Verified live 19:2xZ:**
- issue cmt 6324433966 (nv-slang-bot, 19:16:26Z): the 5-bullet asks the reporter whether they plan to fix it, and asks maintainers whether they want (a);
- labels `reproduced` + Type=Bug;
- #11540 was closed 06-26 by jhelferty-nv (MEMBER), quote checked in cmt 4812768459.

Fixer `sess-1792610420980-0vwcru` is on the canonical thread. It re-checks for a reporter claim before it opens the draft.

**Open loop:** the bot comment says "preparing an automated fix" before the reporter answers. That matches the #13805 handling (draft PR
the same day) and is not an R6 hold.

**10-21 22:01:35Z reporter reply** [cmt 6327515348](https://github.com/shader-slang/slang/issues/13823#issuecomment-6327515348). I checked it live and it has not been edited.
It says "I'm not working on a fix for this, so please go ahead with the diagnostic" and that outcome (b) is enough for them. That settles
ownership. The comment has no @nv-slang-bot mention, but it answers our own public question. The maintainer question on (a) is still open,
since the reporter is not a maintainer. The fixer's 21:57Z progress (its seq 9): 3 commits on `fix/issue-13823`, new test 10/10, output
on targets other than Metal byte-identical, full suite still running, draft PR after the critique gate. It also found that a single-conformer
`createDynamicObject` and a `throws` return reach the bad cast, and covers both. I relayed the reply verbatim to the triager on the
canonical thread, not to the fixer directly, so the fixer keeps one parent edge. No GitHub post just to acknowledge; the next state change
(the draft PR) carries it.

**10-21 22:03Z (triager msg 28):** the triager told the fixer (its msg 17) to go ahead with A and to name the `createDynamicObject` and
`throws` producers in the [Fix Report]. It corrected my plan, and it was right. My 22:0xZ relay said the "in-place refresh of cmt 6324433966"
would carry the next state. The reporter's 22:01Z comment is now the newest, so the observability rule calls for a **fresh delta comment**
when the draft PR opens, not a PATCH. Edit in place only while our comment is still the latest. I did not reply; silence accepts its plan.
Next: the draft PR, then the [Fix Report], then the [Triage Resolution].

**10-21 22:24Z bot draft [#13843](https://github.com/shader-slang/slang/pull/13843)** (`fix/issue-13823`@e46715d2c, `pr: non-breaking`). It is
mapped to fixer `sess-1792610420980-0vwcru`, and saipraveenb25 was auto-assigned as shepherd.

**10-21 22:25Z: the reporter opened [#13844](https://github.com/shader-slang/slang/pull/13844)** ("Metal: give a combined Sampler2D.Handle 16 bytes in an AnyValue",
non-draft, `Fixes #13823`, +537/-53 over 11 files, head ddc7a0ad4). This is outcome (a), with no host producer, so the #11540 decision is
kept. A type that no longer fits gets E41019. In [cmt 6327907095](https://github.com/shader-slang/slang/issues/13823#issuecomment-6327907095)
(22:25:48Z, I checked it live and it has not been edited) the reporter writes: "Could the bot hold its diagnostic-only draft until the
maintainers decide between the two? If they prefer the diagnostic, that works for us too." This reverses their 22:01Z go-ahead 24 minutes
later, so ownership is now split: neither PR supersedes the other until a maintainer picks.
- **Action (my msg to the triager):**
  - hold #13843 as a draft: no ready-flip, no further pushes except a rebase if a maintainer asks for one;
  - keep the PR mapping, because the fixer still owns its draft;
  - post one fresh delta comment on #13823 (the reporter now has the newest comment) that acknowledges the hold and names both PRs for
    maintainers, with no verdict on #13844;
  - send the [Triage Resolution] as PARKED.
- I did not close #13843. The reporter said the diagnostic "works for us too", so both stay open for the maintainer.
- Resume path: one-shot `rechase-13823-maintainer-2329` on 10-28 12:00Z, plus webhooks on both PRs. #13843 webhooks go to the fixer
  through its mapping, and #13844 webhooks reach Main.

**10-21 22:29Z: the reporter closed #13844 (unmerged)** ([cmt 6327960236](https://github.com/shader-slang/slang/issues/13823#issuecomment-6327960236), checked live, unedited).
They want it kept separate from #13755, which it builds on. The 16-byte fix is now one commit, 557906ff6, on
`albertrodriguezclo:fix/metal-combined-sampler-on-13755`. I checked it: 1 ahead of / 0 behind #13755's head 86f2514cd, and the commit
message cites #13823. They will open it as a PR "once #13755 merges, unless maintainers prefer the diagnostic in #13843". The hold on
#13843 is unchanged. The cross-repo `/compare` on the fork returned 401 through the gateway; comparing from the upstream side
(`shader-slang/slang/compare/<sha>...owner:repo:branch`) worked.
- **Action:** I told the triager that the delta comment, which it had not posted yet, must name the stacked commit and the #13755
  dependency, not #13844. I rewrote `rechase-13823-maintainer-2329` to also watch for #13755 merging and for the reporter's new PR.
- **Gap:** when the reporter opens the new PR it may send no webhook to us (a cross-reference is not a comment). The rechase's timeline
  read covers that.

**10-21 22:36Z [Triage Resolution] (triager msg 54): PARKED on maintainer pick.** I checked fresh delta [cmt 6328073437](https://github.com/shader-slang/slang/issues/13823#issuecomment-6328073437)
live (nv-slang-bot, 22:36:14Z, the newest comment). It names #13843 and the reporter's stacked commit as the two options. It says #13844 is closed,
gives no verdict, and asks @saipraveenb25 to choose. Cmt 6324433966 is untouched. #13843 is still a draft @e46715d2c.
- Still open: the fixer's [Fix Report] (it should name the `createDynamicObject` and `throws` producers). The triager forwards it when it arrives.
- Resume: webhooks, plus `rechase-13823-maintainer-2329` on 10-28 12:00Z.

**10-21 22:56Z [Triage Resolution] update (triager msg 56; the fixer's [Fix Report] was its msg 20).** I checked #13843 live: draft @e46715d2c,
`pr: non-breaking`, +260/-6, 8 files, none in slang-emit-metal.*. Files: emit.cpp, any-value-marshalling.cpp/.h, lower-combined-texture-sampler.h,
lower-dynamic-dispatch-insts.cpp, lower-reinterpret.cpp, lower-result-type.cpp, and one new test. Explanation cmt 6328175004 (22:42Z) is on the PR.
- **Where the check lives:** E41014 is raised in `generateAnyValueMarshallingFunctions`, not in `canTypeBeStored`. `canTypeBeStored` runs
  only when a multi-element type set is sized, so it never sees the single-conformer, `reinterpret` or `throws` paths. All 5 producers are covered.
- **Tests:** the new test passes 10/10 (master 4/10); the related suites are green. The full suite has 3 fp8 CUDA failures that fail the same
  way on master. CI is blocked at the `wait-for-human-priority` gate.
- **Still open:** peer review (slang-reviewer R1, ~90 min); the triager forwards any change. Delta cmt 6328073437 is still the newest on #13823,
  so there was no new issue post.

**10-22 00:36Z peer review R1 on #13843 (slang-reviewer `sess-1792622853013-sh1poc`, asked for by the fixer; [Report] to me msg 58, verdict to the
fixer seq 32): REQUEST_CHANGES, 0 bugs, 4-5 gaps.** The diagnostic is correct: 15 probe shapes, 0 regressions, and 0 output differences
across 4776 compiles comparing head and master.
- **Gaps:**
  - the control lanes pass even when the compile fails;
  - the 4 `lowerResultType` source-location scopes do nothing (reverting them keeps 10/10);
  - no test checks the witness-wrapper scope;
  - CPU drops the sampler half, which also happens on master.
- **Remedy:** `remedy-test.patch` + `remedy-drop-result-scopes.patch` (14/14 together). Nothing is posted on GitHub; the PR has no reviews.
- **My call:** my 22:27Z hold said "no pushes unless a maintainer asks for a rebase". Applying the R1 remedies to the draft is allowed: it
  stays a draft, with no ready-flip. The reporter's ask was to not advance #13843 toward merge, and a maintainer should compare the two options
  without known test holes in ours. Sent to the triager, the fixer's parent edge, not to the fixer directly.
- **Separate gap:** CPU drops the sampler half on master too. It is pre-existing and not in this PR's scope. Left to the triager to decide
  whether it needs its own issue.

**10-22 00:39Z (triager msg 66): CPU sampler-half drop, recommended for its own issue.** The triager reproduced it with `-target cpp` on master
23f8fbe9b and on 2026.13.1:
- On CPU, `Sampler2D_0` is `{Texture2D{ITexture*}, SamplerState{ISamplerState*}}`, 16 bytes. The AnyValue pack bit-casts it through
  `uint32_t2`, so the sampler pointer is lost and the read runs past the end of the uint2. rc 0, and the result is silently wrong at run time.
- It also hits a **plain** `Sampler2D` field, not only `.Handle`.
- CUDA is not affected (`CUtexObject` is 8 bytes). #13843 and #11540 don't cover it, and the dedup search found nothing.
- I spot-checked origin/master ffbd1771e5: `slang-ir-layout.cpp` gives every `IRResourceTypeBase`/`IRSamplerStateTypeBase` 8 bytes;
  `slang_bit_cast` is `*(TResult*)(&val)`; CPU `SamplerState` is `{ISamplerState* state}`. Two `gh search issues` queries returned nothing.

**00:4xZ, my call: FILE it** (the #13620/#13622 precedent: bot-filed on a parent Main's order, owned by the filing chain, NO fixer).
- I told the triager to run its own dedup check and OUTPUT_REVIEW first;
- not to dispatch a fixer;
- to report the number.
- ⇒ The coming `issue_opened` webhook for that number is OWNED by this chain: no dispatch, no fresh triage.

**10-22 00:49Z: filed [#13851](https://github.com/shader-slang/slang/issues/13851)** (CPU sampler-half drop). I checked it live. It is owned
by this chain, with no fixer. Record: [[project_13851_cpu_combined_sampler_anyvalue_bitcast]]. Next: #13843 R2 verdict, then the round-2 report.

**10-22 00:59Z (triager msg 70):**
- **R1 remedies pushed.** Checked live: #13843 is still a draft, head 81efc9ddf6 (00:53Z). The test passes 14/14 (master 4/14), and
  `lowerResultType` is back to master. The clarity items are held locally. The explanation comment was refreshed, naming #13851 as out of
  scope. R2 is requested.
- **The reviewer's "pre-existing Metal segfault"** is the existing #13654 (open, `Metal` + `reproduced`; I checked live). The 10-19
  triage-13753 memo already mapped it there. One correction: a field holding only a `SamplerState` compiles with rc 0. Nothing filed, and
  nothing posted on #13654.

**10-22 01:06Z peer review R2 (reviewer [Report] msg 72): APPROVE, 0 bugs / 0 gaps / 0 questions** on head 81efc9ddf6 (checked live: still a draft).
- The commits match the R1 patches exactly. The test passes 14/14 (master 4/14), suites 3053/3053.
- Devin raised only the E41014 wording flag again, which is for maintainers.
- Still to come once a maintainer picks #13843: CI after the ready-flip, including `check-formatting` (not run locally) and the macOS Metal lanes.
  The fixer's clarity commit is held locally and unreviewed.
- Nothing posted on GitHub: the PR has 0 reviews, and delta cmt 6328073437 is still the newest on #13823 and still accurate.
- **State: code side done, parked on the maintainer pick.** Resume on webhooks or `rechase-13823-maintainer-2329` (10-28 12:00Z, pending).

**10-22 01:10Z round-2 [Triage Resolution] (triager msg 76; fixer [Fix Report] msg 28): fixed (diagnostic) and PARKED on the maintainer pick.**
#13843 @81efc9ddf6: 7 files, +334/-6, `lower-result-type.cpp` back to master.
- The clarity renames are held on the fixer's local `wip/13823-r1-clarity` (22e91d0d66), pushed only if a maintainer asks.
- The E41014 wording question (raised by A, C and Devin) is deferred to the maintainers.
- CI, including macOS, is skipped while the PR is a draft.
- No new issue post. The chain is quiescent until a maintainer acts or 10-28.
