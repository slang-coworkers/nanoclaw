---
type: chain
title: slang#13948 — structType assert passing a pointer field of a local struct copy to a function
description: External-filed (xdk78) 2026-10-25. Triaged (bug/high/P2, `reproduced`), fixed in bot draft PR #13951 (head 4e276bf, pr: non-breaking), reviewer APPROVE_WITH_NITS with nits applied. PARKED on the un-draft decision; shepherd kaizhangNV. Ask #2 sent 10-28; re-chase rechase-slang-13948-undraft-r2 (id `rechase-slang-13948-undr-d74c`) 10-31 22:30Z.
tags: [spirv, buffer-element-lowering, pointer, draft-pr, parked]
---

# slang#13948 — `emitFieldAddress` structType assert (pointer field of a local copy)

**Bug.** `Root r = *push.root; f(r.view)` where `View` holds an array: in
`lowerBufferElementTypeToStorageType`, the FieldExtract/GetElement rewrite in
`deferStorageToLogicalCasts` (`slang-ir-lower-buffer-element-type.cpp:~1503`) built its load with the
type deduced from `gep` (logical `Ptr(View)`), not the replaced inst's storage type. Callee
specialization then inserted the storage→logical cast backwards, and `emitFieldAddress` got an array
pointer (`slang-ir.cpp:5831`). A bool-field pointee silently gives invalid SPIR-V instead. Not
amplification-specific; long-standing (asserts back to 2026.12), so it is not labelled a regression.

**Chain.**
- 10-25 ~20:40Z `issue_opened` → slang-triager on `gh-issue-shader-slang/slang-13948`.
- 20:58Z triage: [6403174485](https://github.com/shader-slang/slang/issues/13948#issuecomment-6403174485),
  `reproduced` + Type Bug. Recommended A (keep the replaced inst's type) + C (assert inverted casts).
  The triager handed it straight to slang-fixer.
- 21:46Z draft **PR #13951** (`fix/issue-13948`), pr-mapping → slang-fixer `sess-1792961824237-auyd5v`.
  Board sync auto-assigned **kaizhangNV** as shepherd and requested reviewer.
- 22:16Z slang-reviewer at a09bfb06f: APPROVE_WITH_NITS, 0 bugs. Revert drill fails on master; other
  targets' output is byte-identical. Not posted to GitHub (no authorization marker). The reviewer sent it to
  the fixer itself, and my relay was a duplicate.
- 22:26Z head **4e276bf** with N1–N4 applied. The PR description and explanation comment were refreshed,
  and the fixer edited issue comment 6403794978 in place. CI run 40239717468 was `waiting` at 22:30Z.
- 22:27Z triager `[Triage Resolution]`: fixed, held for a maintainer.

**Disposition: PARKED on the un-draft decision.** The PR is a draft, so it gets no human review until
someone runs `gh pr ready`. Ask #1 went to orchestrator-dashboard on `gh-issue-shader-slang/slang-13948`
at 10-25 ~22:30Z. Re-chase `rechase-slang-13948-undr-bb3e` ran at 10-28 22:30Z (see below).

- 10-28 22:30Z re-chase: no change (draft @4e276bf, 0 reviews, no human comments on #13951/#13948, CI 40239717468 still `waiting`, 6 ok/52 skipped) and no operator answer → ask #2 sent to orchestrator-dashboard on the canonical thread; one-shot `rechase-slang-13948-undraft-r2 (id `rechase-slang-13948-undr-d74c`)` armed for 10-31 22:30Z.

**Out of scope, not filed:** the triager saw that `-emit-spirv-via-glsl` gives invalid GLSL for arrays
inside buffer_reference structs. It needs an operator GO before a separate issue is filed.

**Resume on:** a human comment or review on #13948 or #13951 (webhook → fixer), an operator answer, or
the re-chase. Before forwarding the `pr_ready_for_review` webhook, check `ncl groups list` for
paused approvers.
