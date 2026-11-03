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
