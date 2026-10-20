---
type: project
name: project_13633_bitcast_descriptorhandle_wgsl_bindless_emit
description: "[FIX REPORTED 10-16 08:54Z; draft #13679 head e2c77882c4, CI waiting on human gate; awaits human review] slang#13633 (albertrodriguezclo, external, 10-15 13:15Z): bit_cast<DescriptorHandle<T>>(uint2) ICEs E99997 on all 7 targets, and WGSL prints every DescriptorHandle<T> as T (isResourceTypeBindless hard-wired true). Triaged 13:46Z, handed to slang-fixer: Fix 1 (WGSL emitter uses the layout predicate) + Fix 2-B (a located diagnostic, no new legal cast). Sibling #13641 keeps the resource-table feature."
metadata:
  node_type: memory
  type: project
---

# slang#13633: bit_cast into DescriptorHandle ICEs; WGSL emits handles as resources

**Issue.** Filed by albertrodriguezclo (external), 2026-10-15 13:15:37Z, unassigned. Sibling issue #13641 from the same
reporter came 11 s later (WGSL `chromium_experimental_resource_table` lowering).

**Triage (slang-triager `sess-1792070223292-d21hbq`, 13:46Z; memo at /workspace/inbox/a2a-1792071966357-k6y527/triage-13633.md).**
Bug / medium / P2. Not a regression: the code dates to 5290c5806 (the initial DescriptorHandle commit). Reproduced on master
6597ec920 and v2026.19. The three code sites below were verified at origin/master 6597ec9202 by the Orchestrator:
- `slang-emit-wgsl.h:14`: `isResourceTypeBindless` returns `true` unconditionally, while
  `areResourceTypesBindlessOnTarget` (slang-type-layout.cpp:3549) = CPU|CUDA|Metal only. So WGSL prints
  `DescriptorHandle<T>` as `T` everywhere (signatures, struct fields, uniforms).
- `slang-ir-lower-bit-cast.cpp` `readObject` has no DescriptorHandle leaf → `SLANG_UNEXPECTED` default arm (~:230).
- Extra: cuda/cpp `reinterpret<DescriptorHandle>` + any unrelated user bit_cast → the same E99997 (AnyValue marshalling
  emits bitCasts after the pass gate). HLSL E99999 on `bit_cast<uint2>(handle)` was noted in the memo only and not filed.

**Disposition.** Fix 1 (WGSL emitter → layout predicate) + Fix 2-B (located diagnostic pointing to
`DescriptorHandle<T>(uint2)`; must not fire on compiler-generated AnyValue casts). Option A (make the cast legal) was
rejected because it goes against the #13480 scope signal (tangent-vector cmt 6086339080; jhelferty-nv cmt 6174071727 "Tess prefers narrow").
The triager handed it to slang-fixer, `sess-1792071976607-vgdo6h` on `gh-issue-shader-slang/slang-13633`. Drafts-only applies.
The fixer was told not to reuse E41205 and to expect a processBitCast conflict with draft #13507. Not folded into #13480
(different construct and failure site).

**Split with #13641** (agreed 13:28Z): #13633 owns the emitter fix; #13641 keeps the resource-table feature + #9528 heap,
and its comment points to #13633. Relayed to the #13641 triager `sess-1792070213940-c9g7tq` (landed its seq 4,
13:31:49Z, after two misroutes; see [pin routing](feedback_in_reply_to_beats_target_session_id_pin.md)).

**13:47Z public triage** [cmt 6193619280](https://github.com/shader-slang/slang/issues/13633#issuecomment-6193619280), with the `reproduced` label and Type=Bug (all verified live). The triager will send a [Triage Resolution] once the fixer's [Fix Report] lands. Operator was notified on orchestrator-dashboard.

**10-15 draft PR [#13679](https://github.com/shader-slang/slang/pull/13679)** (checked live): head `ac5a9a34ef`, +271/−23,
Fixes #13633, draft. Mapped to fixer `sess-1792071976607-vgdo6h`. It adds new error E41206 (bit_cast into DescriptorHandle) and removes the WGSL
`isResourceTypeBindless` hook. CI is draft-gated and hasn't run.

**Metal variant (out of scope):** the reporter's cmt 6194533354 (14:30Z) says `Texture2D.Handle` through an interface value →
AnyValue unpack emits `(texture2d<..>)(ulong...)`, invalid MSL. Triager repro'd it on master and 2026.19; cause is
any-value-marshalling.cpp:1245 → emit-metal.cpp:894. The triager replied (cmt 6200923646, 19:50Z) that it's out of scope for
#13679 and asked the reporter to file it; the bot offered to file it otherwise. **Open loop:** if the reporter doesn't file it, the
triager owns filing it.

**10-16 07:37Z:** round-2 review at head `f51b857721` came back APPROVE_WITH_NITS (slang-reviewer `sess-1792093847598-1lwc74`), and the fixer is applying the nits. Still a draft; shepherd is jkwak-work (board-sync). All 5 PR tests are `SIMPLE` compile/filecheck tests, so the GPU-passthrough outage (09-28 to 10-16) didn't affect their verification. The operator notice of 10-16 was delivered directly to the fixer, reviewer and triager sessions.

**10-16 08:50Z follow-up issue [#13695](https://github.com/shader-slang/slang/issues/13695)** (bot-filed by the fixer as the r2 nit "nested-handle limit plus a tracking issue"): aggregate-holding-handle `bit_cast` (GLSL drops the high word on the L40S, WGSL/HLSL/CUDA fail), WGSL/Metal byte-address handle loads, and Metal `as_type` handle casts. Owned: PR #13679 cross-referenced it at 08:52:06Z, so the webhook session dispatched nothing and sent no report. The #13633 Main receives it through the fixer's `[Fix Report]`.

**10-16 08:54Z [Fix Report]** (fixer to triager; copy to Main, checked live): head `e2c77882c4`, `pr: non-breaking`, still a
draft, review requested from jkwak-work (board-sync, not the fixer). CI run 38873310343 is `waiting` on the human gate. 6 tests / 40 lanes, including a
Vulkan+CUDA runtime test on the L40S. Full GPU suite at 82be82e: 10215/10218, with 3 fp8-cuda failures that also fail on master. The clarity reviewer (C) never finished r2
(it died in the restarts). Follow-up issue [#13695](https://github.com/shader-slang/slang/issues/13695), bot-filed and owned by this chain: GLSL
bit_cast of an aggregate holding a handle drops the high word (wrong result confirmed on the L40S), and BAB handle loads → Tint-invalid WGSL;
both also on master. The Metal-variant filing loop (cmt 6194533354) is still open with the triager.

**10-16 08:55Z [Triage Resolution]:** RESTING. The PR is +573/−26 across 17 files and MERGEABLE (checked live). The triager edited cmt 6200923646 in place; it
asks the reporter to file the interface/Metal variant again and offers to file it for them. **Re-check armed:** one-shot task `rechase-13633-draft-pr-dd7b`
at 2026-10-20T13:00Z (no recurrence).

**10-19 20:10Z:** the reporter filed the Metal variant as [#13753](project_13753_metal_anyvalue_texture_handle_cast.md) (cmt 6276275674). It was dispatched to slang-triager on its own thread, so the Metal-filing open loop is closed. At 21:31Z the reporter opened their own fix PR #13755 and our fixer stood down (terminal-for-now; see that record). Rechase `-dd7b` branches (2)/(3) are marked DONE. The same comment flags that #13707 drops the same `isResourceTypeBindless` hunk as #13679, so whichever lands second drops that hunk.

**10-19 20:10Z reporter cmt 6276275674:** filed the Metal variant as [#13753](https://github.com/shader-slang/slang/issues/13753) (still on
2026.20). It also says their own non-draft PR #13707 (#13641 resource-table lowering, `feature/wgsl-resource-table`) contains the same
`isResourceTypeBindless` removal as #13679, so whichever merges second drops that hunk. Routing: I took it, because the sibling Main for #13753
(`sess-1792440638292-w5ihka`) was waiting on me. #13753 went to a fresh triage (slang-triager `sess-1792441084341-wve4gx`, thread `-13753`, given the
earlier Metal findings + #13695 overlap question). The comment went verbatim to the #13633 triager (`d21hbq` seq 30). The metal-filing loop is closed.
Re-check task `rechase-13633-draft-pr-dd7b` was updated with these facts.

**10-19 20:20Z:** the triager replied on the issue (cmt 6276457769). The #13707 overlap is harmless: both PRs produce the identical
`slang-emit-wgsl.h` blob `abd726c0113` (I verified this), and it's the only shared file, so whichever lands second rebases cleanly. No note on #13679, no fixer ping.

**Next resume trigger:** the fixer's draft PR report, or a human comment on #13633.
