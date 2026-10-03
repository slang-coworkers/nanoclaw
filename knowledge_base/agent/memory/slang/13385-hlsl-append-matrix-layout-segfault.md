---
type: chain
description: slang#13385 — HLSL AppendStructuredBuffer.Append of a struct with a non-default matrix layout segfaults; folded into #13379's draft PR #13386 (decision 2026-10-02).
---

# slang#13385 — HLSL `Append` of a non-default-layout matrix struct segfaults

- **Filed:** 2026-10-02 by nv-slang-bot (slang-fixer, while fixing [#13379](https://github.com/shader-slang/slang/issues/13379)).
- **Triage (slang-triager, master `feb2452bf`):** comment 5946564834, label `reproduced`, Type=Bug. P2, not a
  regression (v2025.1 through v2026.19 all crash). Three defects in the append arm of
  `materializeStorageToLogicalCastsImpl` (`slang-ir-lower-buffer-element-type.cpp`):
  1. `getStoreVal` returns null for Append, which is the segfault.
  2. The arm skips `replaceOperand(use, ptrVal)`; fixing only (1) gives E99999.
  3. The deref fast path is wrong for a cbuffer source, the #13379 config mismatch.
  HLSL-only because `slang-emit.cpp:1916` skips `lowerAppendConsumeStructuredBuffers` for HLSL. These are the
  triager's findings; the prototype was stacked on #13386 head `72d277290`.
- **Scope decision 2026-10-02 06:1xZ (mine):** FOLD into draft PR #13386 (`fix/issue-13379`) as a separate
  follow-up commit, pushed only after slang-reviewer's verdict on `72d2772` lands, with no force-push. This
  supersedes my 02:19Z instruction to the fixer to keep it out of the PR, which I gave before the triage showed the fix
  reuses #13386's `storeLogicalValue` and that the cbuffer shape is the #13379 mismatch.
- **Bare-matrix follow-up = [#13388](https://github.com/shader-slang/slang/issues/13388)**, filed 2026-10-02 06:27Z by
  slang-triager (bot-authored, `reproduced`, links #13385; I checked it live). The cause is that `wrapStructuredBuffersOfMatrices`
  (`slang-ir-wrap-structured-buffers.cpp:169-176`) lacks Append/Consume. Long-standing (v2025.1 onward). It is left
  **UNROUTED and no fix is authorized**, same precedent as #13355; a go/no-go is with the operator. The #13385 triage
  comment 5946564834 was edited to name #13388 and #13386.
- **Routing note 06:22Z:** my first "go with A" (`in_reply_to=24`) minted a new empty fixer session
  `pv52v6` on the 13385 thread. It stood down and changed nothing. I resent pinned to `shayfi`, where it arrived as row 22
  at 06:23Z. **The #13386 work lives in `sess-1790901689003-shayfi` (thread …-13379)**. A pin alone misrouted again at 06:35Z. Send with
  `in_reply_to=<the fixer's latest inbound id in my session>` + `target_session_id=shayfi`, then read `shayfi`'s rows. The empty
  `pv52v6` (thread …-13385) catches every other send to slang-fixer from my 13385 session.
- **Ownership:** the triager owns the issue side and posts on #13385. The fixer sends its #13385 [Fix Report]
  to the triager and its #13379 status to me.
- **06:34Z, fixer (`shayfi` row 23):** the fold is committed **locally** as `6624082e46` on `fix/issue-13379`, not pushed; it waits
  for the reviewer's verdict on `72d2772`. The fixer reports `tests/bugs/gh-13385/append-struct-matrix-layout.slang` at 12/12 (7 HLSL + 5 DXIL)
  with the fold and 0/12 without it; the full suite was running (the fixer's report, not checked by me). I told it to cite #13388 as "tracked in", not `Fixes`.
- **08:14Z, slang-reviewer:** its verdict on `72d2772905` is going to the fixer. It is based on 3 of 5 Reviewer-A lenses plus
  Reviewer C and its own build/drill pass, because the Reviewer-A runner killed its own subagents 3 times; any late lens findings come as an addendum.
  Pushing `6624082e46` needs a **delta review**. My 06:23Z order already says so, so there was no action for me.
- **08:17Z, verdict on `72d2772905`: REQUEST_CHANGES** (0 bugs, 1 gap, 1 question), received in `shayfi` as row 30 `in`.
  The gap: the new store-path twin-`CopyLogical` branch is untested. The question: should direct-SPIR-V cbuffer→SB copies keep
  `OpCopyLogical` (valid on master) or accept unpack/pack (+45–66 lines at -O2)? Next: the fixer adds the test, answers the question,
  pushes both commits including `6624082e46`, and sends the new head for a delta review. Devin timed out twice and gave no signal.
- **Re-chase:** `rechase-13385-13388-6855` (2026-10-03 09:00Z).
- **Resumes on:** the fixer's report once the fold commit is pushed, the triager's [Triage Resolution], the
  follow-up issue number, or a human comment.
