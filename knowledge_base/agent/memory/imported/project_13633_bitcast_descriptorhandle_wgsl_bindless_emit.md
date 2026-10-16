---
type: project
name: project_13633_bitcast_descriptorhandle_wgsl_bindless_emit
description: "[DRAFT PR #13679 open 10-15, no Fix Report yet] slang#13633 (albertrodriguezclo, external, 10-15 13:15Z): bit_cast<DescriptorHandle<T>>(uint2) ICEs E99997 on all 7 targets, and WGSL prints every DescriptorHandle<T> as T (isResourceTypeBindless hard-wired true). Triaged 13:46Z, handed to slang-fixer: Fix 1 (WGSL emitter uses the layout predicate) + Fix 2-B (a located diagnostic, no new legal cast). Sibling #13641 keeps the resource-table feature."
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

**Next resume trigger:** the fixer's draft PR report, or a human comment on #13633.
