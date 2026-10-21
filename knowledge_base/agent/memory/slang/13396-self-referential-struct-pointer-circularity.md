---
type: chain
title: slang#13396 — self-referential struct pointer aborts C-like emit ("circularity during codegen")
description: Bot-filed 10-02 (found in #13393 triage); fix is draft PR #13400 owned by fixer session njpemm; coupled to reporter PR #13652 on HLSL/WGSL legs
---

# slang#13396 → draft PR #13400

- **Filed** 10-02 12:17Z by slang-triager on my request (from the #13393 triage). Triage cmt 5952257183.
  The `issue_opened` webhook was our own filing coming back; nothing was dispatched for it.
- **Fix:** draft PR #13400 (`fix/issue-13396`). The emit-ordering walk breaks `Ptr(N)` → `N` → `Ptr(N)`
  at the pointer. **Owner session: slang-fixer `sess-1790896752065-njpemm`** (its thread is
  `gh-issue-shader-slang/slang-13375`, not 13396). Reach it with `target_session_id`.
- **10-20:** albertrodriguezclo (no repo role) posted a function-parameter-only shape (cmt 6287400642).
  The fixer found #13400 already covers it and added 2 test-only files at head **`b85731f2ce`**
  (parent `f83dedb2fb`, no force). Reply cmt 6287951951. Verified on GitHub 10-20 09:4xZ. CI 39400619492
  is `waiting` at the priority gate.
- **Coupling with #13652** (albertrodriguezclo's own non-draft PR, fixes #13632): it makes HLSL/WGSL
  report **E55219** for pointers to memory addresses, and already changes
  `diagnose-circular-pointer-breaks-cycle.slang` to expect E55219 on HLSL/WGSL. #13400's tests have
  HLSL/WGSL legs that expect a clean emit (`self-referential-struct-pointer-emit`, `-param-called`,
  `-param-export`, plus an hlsl leg in `mutually-recursive-struct-pointer`). Prediction, not yet
  measured: whichever PR lands second has to retarget those legs.
  10-20 09:41Z: the fixer confirmed 11 such legs from #13652's diff (`checkUnsupportedPhysicalPointers`), and #13400's Risk line now names
  #13652. I checked the body on GitHub; head is unchanged. A human decides the merge order.
- **Side finding** (nullptr compare/arg → E99999 on HLSL/WGSL) is **already #13632** (PtrLit has no
  HLSL/WGSL emit case), fixed by #13652. Do not file it again.
- **Parked:** marking #13400 ready waits on the operator (the 10-17 list of approved drafts).
