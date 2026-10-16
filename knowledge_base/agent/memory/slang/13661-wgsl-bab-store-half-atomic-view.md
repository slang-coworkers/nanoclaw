---
type: chain
title: slang#13661 — WGSL RWByteAddressBuffer Store<half> rejected; needs an atomic view
description: "albertrodriguezclo, human-filed design question: WGSL BAB sub-word stores (E56103) and BAB Interlocked* (E36107). Asks maintainers to choose (a) atomic<u32> view, (b) opt-in racy RMW, (c) located diagnostic. Triaged 10-15 17:15Z (cmt 6197941951), P2, reproduced; PARKED on maintainer direction."
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
