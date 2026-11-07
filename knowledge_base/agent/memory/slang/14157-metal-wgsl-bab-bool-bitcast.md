---
type: chain
title: slang#14157 — Metal/WGSL `ByteAddressBuffer.Load<bool>`/`Store<bool>` bit-cast bool↔uint
description: Human-filed (albertrodriguezclo, cloth-sim batch) bug 2026-11-02 10:04:32Z. BAB bool load/store emits `as_type<bool>`/`bitcast<bool>`, which Metal and WGSL reject. Reporter states a prepared fix. Dispatched to slang-triager under R6 (hold to 2026-11-06T10:04:32Z), no fixer handoff while a reporter PR is expected.
tags: [metal, wgsl, byte-address-buffer, bool, r6, reporter-fix]
---

# slang#14157 — BAB `bool` load/store bit-casts on Metal and WGSL

**Bug (reporter's analysis; not reproduced by me).** WGSL: `useBitCastFromUInt` in
`slang-ir-byte-address-legalize.cpp` maps `bool`→`uint` (`getSameSizeUIntBaseType`) and emits
`emitBitCast` both ways → `bitcast<bool>(u32)`, invalid per the WGSL spec (Tint not run). Metal: the
emitter's `kIROp_ByteAddressBufferLoad`/`Store` cases write `as_type<T>` for every 4-byte value → Apple
metal rejects `as_type` bool↔uint32. Existing `tests/compute/byte-address-buffer-grouped-bool-11593.slang`
produces rejected MSL (no Metal lane). Master `6815ed82d`.

**Reporter's prepared fix.** `emitBitCastToOrFromUInt` helper (cast when either side is bool/bool-vector)
at the four `useBitCastFromUInt` sites + Metal emit `bool(buf[i])`/`uint32_t(v)`; test
`tests/bugs/byte-address-buffer-bool-convert.slang` (text: metal/metallib/wgsl; run: cpu/vk/mtl/wgpu).
This reporter usually opens their own PR within ~45 min ([13635 lessons](13635-wgsl-nonfinite-const-expr-cluster.md)).

**GitHub at dispatch (11-02 ~10:1xZ).** Open, 0 comments, no labels/Type/assignee, empty timeline. Only
session on the thread was Main's `sess-1793613875534-nv1bnr`. **R6:** no `bot-ok`; fences hold MSL compile
errors, not a crash word → hold to **2026-11-06T10:04:32Z** (comments, PRs, issue-naming commits).

**Overlap.** Reporter's open PRs #13863 (Metal sub-word BAB stores; edits `slang-emit-metal.cpp` +
`slang-ir-byte-address-legalize.cpp`) and #13852 (WGSL half BAB stores; same legalize file). Bot draft
#13607 (`fix/issue-13590`, WGSL bool in uniform/storage buffers via `slang-ir-lower-buffer-element-type.cpp`)
— different pass, likely orthogonal. #11593 closed. Same-batch sibling: [14151](14151-metal-groupindex-scalar-groupthreadid.md).

**Dispatch (11-02).** slang-triager on `gh-issue-shader-slang/slang-14157` with R6 stated, told not to hand
to slang-fixer while a reporter PR is expected (avoid a #13636-style duplicate), to re-read the timeline
before any handoff, and to park with a one-shot re-check after the hold. Owner: slang-triager.

**Triage (11-02 10:20Z, slang-triager).** Bug/medium/P2, reproduced at `6815ed82d`, not a regression
(Metal `as_type` since #3971, WGSL `useBitCastFromUInt` since #5681). naga rejects the WGSL output (wgpu-native
on L40S; no Tint). Metal is checked as text only. bool2, `LoadAligned<bool4>` and bool struct fields also hit it;
cpu/vk/cuda run correctly. **Dedupe:** #10207 (open, WGSL bool struct-field BAB load) is a subset, so one fix closes
both. **Overlap:** #13863 conflicts at either fix site (same author); #13852 and #13607 are orthogonal; `bool[N]` goes
to #13805. **Layer:** Approach A. The legalize step (not the emitter) owns the bool rule: keep bool→UInt in
`getSameSizeUIntBaseType`, cast instead of bit-cast at the 4 sites, and send Metal scalar bool through
legalization the same way as 64-bit (`:202-214`, which I spot-checked). The reporter's plan is B (emit-side Metal).
GitHub: Type=Bug and `reproduced` set 10:17Z, 0 comments (labels are allowed under R6, see 14034/14036). Memo
`/workspace/inbox/a2a-1793614814851-xmlbkm/triage-14157.md`; draft held `…/a2a-1793614814888-6wz2wa/comment-14157.md`.

**Decision (11-02, me): no fixer now.** Re-decide at the hold end only if no reporter PR exists. **Timer:**
triager one-shot `t-92b792` at 2026-11-06 10:20Z re-checks, posts the held comment, and asks me for the fixer
decision. It never dispatches the fixer itself. **Resumes on:** reporter PR, human comment, or t-92b792.

**Reporter PR (supervisor tick 321).** albertrodriguezclo opened [#14167](https://github.com/shader-slang/slang/pull/14167) (`Fixes #14157`) at 11-02 10:34Z. It is non-draft and BLOCKED, waiting on a maintainer review. No bot fixer: the R6 release one-shot must reconcile with this PR instead of posting a planned fix.

**11-04 21:41Z — maintainer question** (jkwak-work, cmt 6642827280, `@nv-slang-bot`): *"what is the size of `bool`
type for each target that slang supports?"* jkwak-work is the auto-assigned shepherd of #14167 (still open, no
review). I routed it 21:43Z to the triager's owner session `sess-1793614043803-fyxk6j` (landed seq 16, running), with
`<github-post-authorized />`. Asked for a per-target table: register vs each buffer kind/layout rule, plus the IR's
natural size, each with `file:line` and a check. **Gate open:** the 11-06 hold was stale (R6 wait retired, see
[project_13591](../imported/project_13591_ai_contributor_standards_batch.md)). The answer may carry one triage line.
`t-92b792` must edit the reply in place or be cancelled, never post a second comment. **Next:** triager reports the
comment URL.

**11-04 22:07Z — answer posted** ([6643360049](https://github.com/shader-slang/slang/issues/14157#issuecomment-6643360049),
nv-slang-bot, verified live; codex OUTPUT_REVIEW passed in round 2). Summary: buffers use 4 bytes on HLSL/DXIL, SPIR-V/GLSL
(std140/std430/scalar/dx), WGSL and LLVM std140/430, and 1 byte on Metal, CUDA, CPU, slangvm and C layout. The IR's
natural size is 4 (`slang-ir-layout.cpp:129`). Slang `sizeof(bool)` is 1 everywhere. Reflection was checked on 14 targets,
and CPU/CUDA/VK were run on the L40S. The held triage draft is dead. `t-92b792` is now edit-only (it updates the status line).
**Side findings → told the triager to dedupe, re-confirm on master, and file without asking (filing policy), filed-only, no
fixer:** (1) generic `sizeof(T)` with T=bool gives 4 (IR peephole, natural rules) where concrete `sizeof(bool)` gives 1;
(2) `docs/user-guide/02-conventional-features.md:75-84` says 4, plus stale CUDA bool comments
(`slang-type-layout.cpp:776-783`, `docs/target-compatibility.md:216`); (3) `-target host-cpp` ICE at
`slang-ir-transform-params-to-constref.cpp:463` and `llvm-host-ir` "Unsupported instruction". **Their `issue_opened`
webhooks need no dispatch: this chain owns them.**

**11-04 — side finding (3) filed as [#14328](https://github.com/shader-slang/slang/issues/14328)** (nv-slang-bot,
label `reproduced`): `-target host-cpp` ICE, assert `layoutDecoration` at
`slang-ir-transform-params-to-constref.cpp:463` for a compute entry point with an `SV_*` parameter; `-target cpp`
compiles it. Suspected cause: no `HostCPPSource` case in `getDefaultLayoutRulesFamilyForTarget`
(`slang-type-layout.cpp:3031`); related #12392. Its `issue_opened` webhook reached me: no dispatch (this chain owns
it, filed-only, no fixer). The `llvm-host-ir` half is #14329.

**11-04 — side finding (3) filed as [#14329](https://github.com/shader-slang/slang/issues/14329)** (nv-slang-bot, label
`reproduced`): `-target llvm-host-ir` ICE "Unsupported instruction for LLVM target!" on a global `RWStructuredBuffer`
(suspected leftover `global_param`, no `kIROp_GlobalParam` case in `slang-emit-llvm.cpp`; same `default:` as #14191).
`issue_opened` webhook received; **no dispatch** (filed-only, this chain owns it). The `host-cpp` ICE is filed separately.

**11-04 22:28Z — side-finds filed** (slang-triager): (1)+(2) → [#14327](14327-generic-sizeof-bool-4-vs-concrete-1.md)
(generic `sizeof(T)` bool 4 vs 1, plus the stale docs/comments); (3) split into #14328 (`host-cpp` assert `layoutDecoration`)
and #14329 (`llvm-host-ir` unsupported instruction). All filed-only, Type=Bug + `reproduced`; their webhooks need no dispatch.

**11-06 10:21Z — `t-92b792` ran (edit-only): no change.** #14157 is open. #14167 is open, non-draft and unmerged, at head
`480bff04a` (reporter nits 11-04 23:05Z; coderabbit re-reviewed). 6643360049 is still accurate, so it was not patched.
Nothing was posted. **Decision (me): no new timer.** A merge or close of #14167, or the issue closing, arrives as a
webhook or a supervise-issues tick. Then the triager PATCHes only the "Issue status:" line of 6643360049.
**Chain is idle; owner slang-triager; no fixer.**

**11-06 16:43Z — jkwak-work comment** ([6690153386](https://github.com/shader-slang/slang/issues/14157#issuecomment-6690153386),
MEMBER, **no bot mention**): *"I am gonna discuss about the size of bool from Slang perspective in a meeting, because it is
unclear to me. I think when the sizeof(bool) on the target is not 4 bytes, we may need to emit `uint` instead of `bool`."*
No reply was asked for, so nothing was posted (precedent: szihs on #13596). **PARKED on a maintainer decision** (the bool-size
policy). It may reshape #14167, now at `fbf00ddcd`, and #14327. Register: supervisor-state disposition updated 16:50Z. No
one-shot timer. **Resumes on:** a maintainer comment or review on #14157/#14167, or a #14167 merge/close. I told the triager
(FYI only, no post).

**11-06 18:59Z — jkwak-work after the meeting** ([6692959097](https://github.com/shader-slang/slang/issues/14157#issuecomment-6692959097),
MEMBER, no bot mention): *"We discussed this and I learned that I was under the wrong impression that the size of a type should be
consistent across all target platforms. Based on the new information, I will review the issue and propose the fixes more
carefully."* So the per-target sizes are now accepted, and the next step is the maintainer's: review #14167 (still `fbf00ddcd`,
no jkwak-work review yet) and propose fixes. No reply was asked for, so nothing was posted, and the triager was not pinged.
Register disposition is now `advisory:maintainer-review`. **Resumes on:** a review or comment on #14167, a bot mention, or a
#14167 merge/close.
