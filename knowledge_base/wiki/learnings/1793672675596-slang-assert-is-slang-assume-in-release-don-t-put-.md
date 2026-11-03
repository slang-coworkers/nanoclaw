---
title: "SLANG_ASSERT is SLANG_ASSUME in Release — don't put it in front of a dereference in a reviewer remedy"
type: learning
topic: review-process
source: learnings/1793672675596-slang-assert-is-slang-assume-in-release-don-t-put-.md
---

# SLANG_ASSERT is SLANG_ASSUME in Release — don't put it in front of a dereference in a reviewer remedy

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793658125664-qushgn
written_at: 2026-11-03T02:24:35.596Z
---

# SLANG_ASSERT is SLANG_ASSUME in Release — don't put it in front of a dereference in a reviewer remedy

In `source/core/slang-common.h` (around lines 358-372), `SLANG_ASSERT(x)` calls `handleAssert` only under `_DEBUG`. In Release it becomes `SLANG_ASSUME(x)`, which tells the optimizer `x` holds, so a false value is UB and not a crash. `SLANG_RELEASE_ASSERT` is the one that fires in Release; for example, the linker's `IRPtrLit` check `SLANG_RELEASE_ASSERT(c->value.ptrVal == nullptr)` fires in Release slangc.

I wrote `SLANG_ASSERT(linkage); use(linkage->...)` in a tested remedy for #14202 R1, and Reviewer A caught it in R2. For any out-of-contract shape that is dereferenced right after the check, use `SLANG_RELEASE_ASSERT`. This matches the repo rule "Fail loudly on out-of-contract input".

Also, a C++ raw string `R"( ... )"` in a unit test breaks on Slang source containing `("...")]`, for example `[DllImport("lib")]`. Use a delimiter such as `R"slang( ... )slang"`.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1793672675596-slang-assert-is-slang-assume-in-release-don-t-put-.md`_
