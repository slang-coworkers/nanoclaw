---
type: project
name: project_13753_metal_anyvalue_texture_handle_cast
description: "TERMINAL-FOR-NOW 10-19 21:41Z. slang#13753 (albertrodriguezclo, external, 10-19 20:10Z): Metal AnyValue pack/unpack of texture/sampler/AS DescriptorHandles emits C casts to/from ulong, invalid MSL (buffer handles fine). Variant of #13633, filed at our request; triaged bug/P2. The reporter owns the fix, non-draft PR #13755 (reinterpret through a thread pointer); bot fixer stood down, pushed nothing. Resume only if #13755 is abandoned and a maintainer asks, or a human addresses the bot."
---

# slang#13753: Metal emits a C-style integer→texture cast for an AnyValue-unpacked handle

**10-19 20:10:34Z, `issue_opened`.** Live read at ~20:12Z and again at 20:18Z: open, 0 comments, no labels, unassigned.
The timeline shows only the reporter's cross-reference from #13633. Their #13633 cmt 6276275674 (20:10:41Z) says it was filed
because the bot asked (cmt 6200923646). It still reproduces on 2026.20. The same comment notes that #13707 (#13641's
resource-table PR) removes the same `WGSLSourceEmitter::isResourceTypeBindless` hunk as #13679.

**Ownership check.** Only my webhook session `sess-1792440638292-w5ihka` was on the canonical thread. The #13633 Main
(`5zruuf`) got the cmt 6276275674 `pr_mention` at its seq 96. I polled it for about 3 min and it sent nothing, so this
session decided. Rechase `rechase-13633-draft-pr-dd7b` branch (2) would otherwise have told the triager on the
#13633 thread on 10-20.

**Prior diagnosis** (#13633 triager `d21hbq` seq 25, 10-15): the AnyValue unpack emits `CastUInt64ToDescriptorHandle`
(any-value-marshalling.cpp:1245). emit-metal.cpp:894-906 prints that as a C cast. This is a supported path that needs a real
Metal lowering, not E41206. The neighbouring scope is #13695 (Metal `as_type` / byte-address handle loads).

**10-19 ~20:19Z:** dispatched to slang-triager on `gh-issue-shader-slang/slang-13753` (msg 67), with the overlap question
"separate fix, or part of #13695's scope?" left to the triager. The rechase task's prompt was edited so (2)/(3) are DONE and
it does not route #13753 again. Not held under R6: nanoclaw #1993 is still a draft, and we asked for this filing.

**10-19 20:23Z triager progress (msg 72; triager session `sess-1792441084341-wve4gx`):** reproduced on master 837ab4c34 and 2026.13.1.
Pack is broken too (`(ulong)(_S1->tex_0)`). RWTexture2D, Texture3D and SamplerState handles fail the same way. A StructuredBuffer handle
gives a legal pointer cast, which matches the buffer-only #10477/#10849 fix. Not a duplicate. Its first updates went to the
#13633 Main (`5zruuf`), which sent the triager back here (its seq 173); it will now report to this session.

**10-19 20:24Z (msg 78):** triager root cause: Metal AnyValue marshalling treats every 8-byte handle as a pointer
(any-value-marshalling.cpp:675-702 pack, :1217-1249 unpack). That is right for buffer handles and wrong for texture/sampler handles.
It is checking what MSL allows before choosing a real lowering or a diagnostic.

**10-19 21:13Z [Triage] (msg 80; memo copy at /workspace/agent/reports/triage/triage-13753.md):** bug / medium / P2,
IR AnyValue marshalling + Metal emit, not a regression (the texture case never worked). Labels `reproduced` + Type=Bug (verified
live). Key finding: MSL 4.1 has no 64-bit→texture/sampler conversion (`as_type` §2.23 takes only non-pointer scalars and vectors;
the only MTLResourceID conversion is AS→ID, §6.19.6). That **corrects our #13633 note** that this path "needs a real Metal lowering". The memo puts that note in cmt 6200923646, but the live comment doesn't have it (checked 21:15Z). It was only internal (triager seq 25, my 20:19Z dashboard message, this file), so no public correction is owed.
- **A (recommended, dispatched):** a located E41014 from `canTypeBeStored` (lower-dynamic-dispatch-insts.cpp:743), which today skips
  the opaque check on bindless targets, plus fail-loud checks in the Metal marshal arms, and a shared "lowers to a pointer on Metal" predicate.
  The existing #9131 test descriptor-handle-dynamic-dispatch.slang already emits the invalid MSL; it passes only because it checks `computeMain`.
- **B (maintainer call, jvepsalainen-nv):** carry non-byte resources outside the AnyValue for closed sets (`lowerUntaggedUnionType`).
  Rejected: reinterpreting through memory, ulong handles, and a handle that is the address of an ID slot (would change the slang-rhi #802 ABI).
- **Overlap:** separate from #13695, but its predicate should drive #13695 items 2-3 on Metal. With #13679 there is only a trivial emit-metal.h rebase.
- Fixer `sess-1792444400911-jxjuzh` on this thread. The triager posts the 5-bullet with B as the open question and a workaround (a uint index into `Texture2D[]`).
- I spot-checked :675 and `canTypeBeStored` on origin/master 837ab4c340: they match the memo.

**10-19 21:13:58Z public triage** [cmt 6277456430](https://github.com/shader-slang/slang/issues/13753#issuecomment-6277456430). It asks @jvepsalainen-nv the B question and gives the `uint`-index workaround. It was edited 21:15:00Z to drop a "corrects #13633" sentence after my msg 85. I checked live: the sentence is gone and it is the only comment. Fixer worktree `wt-slang-13753`, branch `fix/issue-13753` @ 837ab4c34.

**10-19 21:29Z scope revision (triager msg 88):** the codex diagnosis review (3 rounds) approved the diagnosis but rejected A-only,
because a diagnostic alone narrows the issue's goal ("the output compiles"). New brief to the fixer (its msg 25):
- **B (target):** a typed closed-set payload that keeps texture/sampler handles out of the AnyValue bytes.
- **A:** a located E41014 on the byte-only paths (`lowerReinterpret`, open-world `lowerCreateExistentialObject`).
- **Fallback:** if B is infeasible, A ships as `Related to #13753`, the reason goes on the issue, and jvepsalainen-nv decides.
cmt 6277456430 was patched in place at 21:29:06Z (checked live) and asks whether a typed closed-set payload on Metal is acceptable.
⚠️ B is core typeflow lowering, which the triager's own first pass rated medium-high risk and needing maintainer direction, and it now
proceeds before that answer. The #13633/#13480 precedent was "Tess prefers narrow". I flagged this to the operator rather than overriding the triager.

**10-19 21:31Z: the reporter's own PR [#13755](https://github.com/shader-slang/slang/pull/13755)** ("Fix in #13755", cmt 6277771763). It's non-draft,
on `albertrodriguezclo:fix/metal-anyvalue-handle`, +141/−6, `Fixes #13753`. Metal emit only: for texture/sampler/AS handles the two
`Cast*DescriptorHandle*` ops become `FoldPolicy::Never` statements that reinterpret a local via `*(T thread*)(&bits)`, modelled on
`kIROp_MetalCastToDepthTexture` (emit-metal.cpp:697). Buffer handles keep the C cast. New test tests/metal/descriptor-handle-texture-dynamic-dispatch.slang.
This is the triager's rejected **approach C** (reinterpreting through memory, unspecified in MSL), and it conflicts with the public "cannot be written in MSL" line.
- **Action (msg 99 to the triager, in_reply_to 88):** stand the fixer down (no competing PR, following #12026/#12127), refresh cmt
  6277456430 in place to point to #13755, state any approach-C concern factually without a verdict on a human PR, and reap `wt-slang-13753`.
- I did not message the fixer directly, to avoid a second parent edge. Its last row was 21:29 (revised brief; build not finished), so no PR was imminent.

**21:35Z (triager msg 98):** fixer told to stand down (its msg 31): push nothing, remove `wt-slang-13753`, confirm back. Refreshed comment drafted (points to #13755, drops the stale scope and maintainer question), in output review before the in-place patch of 6277456430.

**10-19 21:41Z [Triage Resolution] (msg 100): TERMINAL-FOR-NOW, abandoned on our side.** The fixer stood down at 21:37Z:
nothing pushed or posted, `wt-slang-13753` removed, branch deleted (0 commits, never on origin). Cmt 6277456430 was refreshed in place at
21:40:42Z (checked live):
- it points to #13755 for maintainer review, with no competing PR;
- it drops the jvepsalainen-nv typed-payload question;
- it **publicly retracts** the 21:13 blanket "cannot be written in MSL" line and says the spec doesn't settle reading through a pointer;
- it adds `reinterpret<uint2>(Texture2D.Handle)` and open-world `-conformance` as further paths with the same casts.
We gave no verdict on #13755; no bot comment is there (2 comments, none ours).
- **Lesson:** the triager's 21:13 "cannot be written in MSL" overstated the spec. The spec rules out `as_type` and direct conversion, not
  reinterpreting through memory, and the reporter's PR does exactly that following an existing in-tree pattern (`MetalCastToDepthTexture`).
  "The spec has no conversion X" is not "X is inexpressible".
- **If a `pr_ready_for_review` / review webhook for #13755 reaches Main:** it is a human PR, so check `paused` before routing it to an approver (Core Memory).
- No timer was armed: the chain is not ours to wait on, and webhooks deliver #13755's merge/close and any @-mention.

**Next resume trigger:** #13755 abandoned + a maintainer asks us to take over, or a human addresses the bot on #13753. On merge, the triager sends one final line. After that, re-open only on an @nv-slang-bot mention, a maintainer ask, or #13755 being abandoned.

**Superseded trigger:** the triager's public 5-bullet [Report], then the fixer's draft PR / [Fix Report] → [Triage Resolution].

Related: [project_13633](project_13633_bitcast_descriptorhandle_wgsl_bindless_emit.md).
