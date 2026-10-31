---
type: chain
title: "slang#14101 — SPIR-V `?:` selection between independently declared Texture2D / SamplerState / Buffer<T> → E56004"
description: Human-filed (pdeayton-nv, `bot-ok`, assigned to pdeayton-nv by jhelferty-nv) feature request 2026-10-30 19:47:17Z. Dispatched to slang-triager; R6 exempt via `bot-ok`.
tags: [slang, spirv, opaque-types, resources, E56004, pdeayton-nv, bot-ok]
---

# slang#14101 — select between independently declared resources on SPIR-V

**Ask.** `Texture2D t = b ? texA : texB;` (likewise `SamplerState`, `Buffer<float4>`), where each
operand is a separate global, fails on `-target spirv-asm` with E56004 ("opaque type in local
variable is not supported for Khronos targets"). Preferred: valid SPIR-V that keeps which resource
each branch picks. Workaround: move the resource ops into each branch and select the results.
Reported on v2026.20.

**Related (same repo).** #13248 (closed 10-17, tangent-vector: selection when resources come from
the *same heap*; cross-referenced by #13539, #13548, #13685, #13700). #14101 is the
independently-declared counterpart. Same reporter + E56004 family:
[#13685 / PR #13700](13685-undefined-texture-phi-fold.md), #14076 / draft PR #14081 (undefined
opaque handles). Not a follow-up that an existing chain owns: no memory hit, no bot authorship.

**Routing (10-30 ~19:50Z).** Live check: open, 0 comments, label `bot-ok`, assignee pdeayton-nv.
Only session on the thread was Main's `sess-1793389639227-5gbefy`; no triager session. Dispatched
to slang-triager on `gh-issue-shader-slang/slang-14101`. R6: `bot-ok` → posting allowed now.
The reporter is the assignee, so no fixer without the reporter's go-ahead.

**Triager ack (10-30 19:50Z, triager's finding, not verified by me).** #13248 was closed by the
reporter's own merged PR #13539 (`specializeResourceSelection`: a same-source heap/array selection
becomes an index select). #14101 is the different-source case that this PR leaves unchanged.
The 5-bullet report is pending.

**Triage (10-30 19:58Z, slang-triager).** Comment 6532269475 (I checked: posted by nv-slang-bot at 19:57:49Z;
Type=Feature, labels `reproduced` and `bot-ok`). Rated feature/medium/P2, IR (SPIR-V/GLSL). Reproduced
on ToT 0cea40935 and on v2026.20. Not a duplicate, and does not overlap #13685/#14076.

PR #13539's `specializeResourceSelection` handles only leaves from one heap or array. For bare
globals it returns false (`slang-ir-specialize-resources.cpp:1845`).

Triager's spirv-val probes: OpSelect and OpPhi on an image or sampler are illegal; so is OpSelect on
a UniformConstant pointer; a descriptor index would break the ABI. ⇒ Branch-sinking is the only
legal lowering.

- **Rec A:** extend #13539's selector graph. Each consumer becomes a switch on the integer selector.
- **Risks:**
  - Implicit-derivative ops in divergent flow. Fix is B (speculate pure ops) or SampleGrad.
  - A cross product when there are several selections.
  - Three E56004 tests must change.
- **Maintainer calls:** WGSL inclusion, and Metal/DXIL E56019.

PARKED on pdeayton-nv (reporter and assignee): bot draft PR, or self-implement? Also the derivative
choice. Triager one-shot t-5434f7 runs 11-06. No fixer. Memo: inbox `a2a-1793390327633-qfoj2i/triage-14101.md`.

**Side finding (I verified it on local Release 0cea40935a).** `ConstantBuffer<S> c = b ? cbA : cbB;`
with `-target spirv-asm` exits 0 and emits `%c = OpVariable %_ptr_Function__ptr_Uniform_S_std140 Function`.
With `SLANG_RUN_SPIRV_VALIDATION=1` it fails with "Logical addressing … StorageBuffer or Workgroup" and
then E99999. `gh search` found no existing issue. 10-30 ~20:05Z I directed the triager to bot-file it,
with the same direction as for #14089: Type=Bug, `reproduced`, options presented, park on a maintainer,
no fixer handoff. **That issue's `issue_opened` webhook belongs to this chain (no dispatch). Record its number here.**

**Side find filed as #14102 (10-30 20:02:20Z).** I checked it: nv-slang-bot, Type=Bug, `reproduced`,
unassigned. The scope grew. `ParameterBlock<T>` on SPIR-V gives E99997. GLSL gives E99999. The HLSL
output fails DXC. WGSL, Metal, CUDA and CPU compile. It also failed on v2026.1 and v2025.15, so it never
worked (no `regression` label). Options presented: an E56004-style diagnostic; fold into the #14101
lowering together with the #13539 CB-array case; or a struct copy as in the WGSL output. PARKED on a
maintainer; no fixer. **#14102 webhooks need no dispatch.** The timer was folded into t-5434f7 (asked
10-30 ~20:05Z). Triager state: its `issues/14102.md`.
**10-30 20:03Z:** the triager confirmed that t-5434f7 (2026-11-06 16:00Z) covers both issues. #14101: on the
reporter's go-ahead, hand to slang-fixer; if the reporter self-implements, close on our side. #14102: maintainer
direction comes back to Main for go/no-go, not straight to the fixer. With no reply, both stay parked (no re-ping).
The result is one combined `[Report]`.

**10-30 23:13Z, maintainer comment by tangent-vector (6535486408).** It contains no @nv-slang-bot mention. The comment
says the team must choose a duplication policy for an operation whose resource or sampler operand is a selection.
(1) Allow a single-level `cond ? a : b` only, where the options are not themselves conditional. (2) Expand the
operation into a conditional over two operations and recurse; this is more general but can grow exponentially. The
maintainer leans toward (2) "if it can help eliminate a whole class of messy operations". I forwarded the comment
verbatim to the triager session `sess-1793389761883-a3d57l` on the canonical thread. I gave no post authorization
beyond the triager's own judgement + OUTPUT_REVIEW. The reporter's bot-PR go-ahead is still pending.
**10-30 23:30Z:** the triager replied with facts only (6535708138; I checked: nv-slang-bot 23:30:12Z, OUTPUT_REVIEW
passed in round 2). A selection-graph walk with a visited set gives one copy per distinct leaf. Path-wise recursion
duplicates more for repeated leaves and shared DAGs, and it never terminates on a loop-carried selection
(`resource-selection-loop.slang`). On a distinct-leaf tree the two counts are equal. Texture × sampler multiplies
unless correlated. Derivatives: expanding into a branch loses defined LOD only on `quadDivergentImplicitLod` devices.
The repro uses SampleLevel. Still PARKED on the policy choice (tangent-vector / pdeayton-nv) and on the reporter's
bot-PR go-ahead; t-5434f7 covers it.
**10-30 23:30Z, change:** when pdeayton-nv's bot-PR go-ahead lands, t-5434f7 now routes it to Main for a go before any
slang-fixer handoff. The policy choice is recorded and reported up, with no handoff. #14102 is unchanged.
