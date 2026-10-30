---
type: project
name: project_13900_metal_top_level_descriptor_handle_layout
description: "slang#13900 (skallweitNV, MEMBER, 10-24 21:27Z, unassigned, 0 comments): on Metal a top-level DescriptorHandle / T.Handle uniform is reflected + emitted as a bound resource ([[buffer(n)]], binding kind constantBuffer) instead of ordinary uniform data, so slang-rhi setDescriptorHandle() has nowhere to write. Asks maintainers: intentional exception or bug? TRIAGED 10-24 21:50Z (cmt 6389968314, label reproduced, bug/medium/P2): root cause is #6028 layout rule slang-type-layout.cpp:5771-5773; options A/B(recommended)/C put to jhelferty-nv + csyonghe; PARKED on maintainers, no fixer; 10-26 assigned to kaizhangNV (by jkwak-work), now maintainer-owned; 10-27 skallweitNV closed slang-rhi PR 802 unmerged pending #13900. Our 'intentional upstream' claim retracted on #13900 and #10842 (PR 802 question moot). No bot ping; triager re-check 11-05 15:00Z."
metadata:
  node_type: memory
  type: project
---

# slang#13900: Metal top-level `DescriptorHandle` uses resource bindings

**Report (skallweitNV, slang-rhi maintainer, 2026.17.1, M2 Max).** `uniform StructuredBuffer<float>.Handle input;`
emits `float device* input_1 [[buffer(0)]]` and reflects as `binding.kind = constantBuffer`. The docs say a
descriptor handle "is always an ordinary data type". The workaround (handle inside a `ParameterBlock`) yields an
argument-buffer field and works. The reporter prefers a compiler-generated constant/argument-buffer struct for
top-level handles, with reflection offsets updated at the same time.

**Why it is a design question, not a plain bug.** It contradicts two tested decisions:
- #11066 fixed top-level handle binding indices; `tests/metal/entry-point-descriptor-handle-buffer.slang` expects
  resource bindings.
- #11970: assignee jhelferty-nv (cmt 5098719946) said to keep `IRPtrType -> ulong` and **not** wrap top-level
  `.Handle` params. See [[project_11970_metal_bindless_msl]].
Neighbouring chain: [[project_13823_metal_combined_sampler_handle_anyvalue]] (Metal AnyValue handle size, parked).

## Routing (10-24, Main sess-1792877242682-0jdcly)

Live read at dispatch: open, 0 comments, no assignee, no labels, body = payload. No other session on the canonical
thread. R6 gate (nanoclaw #1993) is still a draft, so routing is unchanged. Dispatched to `slang-triager` on
`gh-issue-shader-slang/slang-13900`: reproduce on master, trace the #11066 / #11970 decisions, post the 5-bullet that
puts the choice to the maintainers. No fixer and no PR until a maintainer picks a direction. Cite slang-rhi
items as plain text ([../feedback_no_gratuitous_cross_repo_links.md](../feedback_no_gratuitous_cross_repo_links.md)).

**10-24 21:30Z:** triager acked (repro on master + #11066/#11073/#11970 history trace, no fixer, labels untouched).
Live check: the reporter set label `RTR` and Type=Bug at 21:30Z; still unassigned, 0 comments.

**10-24 21:32Z (triager's finding, not yet checked by Main):** reproduced on master `52e29ab43`, byte-identical
to the report (`input_1 [[buffer(0)]]`, reflection `constantBuffer`). A second shape, an entry-point `uniform`
handle param, behaves the same way. Tracing the layout code and the PR history next.

**10-24 21:39Z, root cause (triager's finding, not yet checked by Main):** a single #6028 layout rule,
`slang-type-layout.cpp:5771-5773`, gives a Metal handle T's layout, which is a binding slot. Neither #11073 nor the
#11970 guidance (scoped to its own PR 1) made a binding-model decision.

⚠️ **Our bot's own false public claim (checked by Main).** nv-slang-bot's slang-rhi PR 802 comment 5167626814
(2026-08-03) says "that direct binding is intentional upstream, not a codegen bug", inferred from the
slang-emit-metal unwrap and the #11066 test. #13900 cites that comment. PR 802 is a bot draft, still open; its owner
is the slang-fixer session on `gh-issue-shader-slang/slang-10842` (sess-1784923127685-7w0gz7, last active 09-28).
I told the triager to retract the claim in plain text in its #13900 post. Whether to also correct it on PR 802 is
an open operator decision.

**10-24 21:50Z, TRIAGED (checked live by Main).** Comment
[6389968314](https://github.com/shader-slang/slang/issues/13900#issuecomment-6389968314) by nv-slang-bot. Labels are
`RTR` and `reproduced`, Type=Bug, unassigned. The comment pings @jhelferty-nv and @csyonghe, cites PR 802 in plain text
(no slang-rhi link) and carries the retraction. Memo archived at `/workspace/agent/reports/triage/triage-13900.md`.
- Triager's findings: bug/medium/P2, no duplicate, no overlap with #13823. Two more mismatches: an entry-point
  `uniform` handle gets a reflected slot while MSL puts it in the struct (`scale` reflected at offset 0, emitted at 8),
  and a `StructuredBuffer` record handle is 0 bytes in reflection but an 8-byte pointer in MSL.
- Options: A keeps the slots and documents the exception. B (recommended) makes the handle ordinary data with the
  argument-buffer layout; it breaks reflection and 3 tests, and slang-rhi must bind GlobalParams as an argument buffer.
  C is B behind an opt-in option.
- Triager's one-shot re-check `t-17876f` fires 2026-10-29 15:00Z. From Main, `ncl tasks get` reports "not found",
  which is expected for a peer group's task and does not mean it is missing.

**10-29 15:02Z re-check (verified live by Main):** still only our comment. jkwak-work assigned the issue to
**kaizhangNV** on 10-26 17:12Z, so it is maintainer-owned. skallweitNV closed slang-rhi PR 802 unmerged on 10-27
12:43Z (cmt 6442179704): "Slang first needs to address #13900", with a Metal bindless branch waiting on it. That
leans to B but is not a pick. 3 min later the slang-fixer #10842 chain posted slang#10842 cmt 6442225736, which also
corrects the 08-03 "intended" claim. So the PR 802 correction question is **moot**: the PR is closed and the claim is
retracted on #13900 and #10842.
- Main's decision: **no bot ping to @kaizhangNV.** The issue was assigned after our triage comment, which already
  sets out A/B/C. The PR 802 closure is already cross-referenced on the timeline, and a second bot post on a
  maintainer-assigned issue is noise. Hand off to slang-fixer only if the assignee or a maintainer asks for a bot
  PR. Triager one-shot re-check 11-05 15:00Z.

**Resume:** maintainer comment (webhook), the triager's re-check, an operator answer on the PR 802 correction, a human comment on #13900 (webhook), or an operator ask.
