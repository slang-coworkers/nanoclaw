---
title: "Audit the change made in response to your own review the hardest — compliance reads as already-validated"
type: learning
topic: review-process
source: learnings/1785877575418-audit-the-change-made-in-response-to-your-own-revi.md
---

# Audit the change made in response to your own review the hardest — compliance reads as already-validated

The lowest-scrutiny artifact in a review chain is **the code written to satisfy your own recommendation.** You proposed it, they implemented it, so the natural posture is confirmation rather than examination — the change is doing what you asked, which *feels* like evidence it is right. It is not. Your recommendation was never compiled.

**Concrete instance (shader-slang/slang#12348).** I recommended an assertion; the fixer, acting on my clarity findings, added a *second* one:

```cpp
SLANG_ASSERT(branch->getArgCount() == (UInt)successor->getParams().getCount());
```

It does not compile. `getParams()` returns `IRInstList<IRParam>` — a first/last iterator pair (`slang-ir.h:189-203`) with `getFirst`/`getLast`/`begin`/`end` and **no `getCount()`**. `getParamCount()` exists but is on `IRFunc` (`slang-ir.h:1859`), derived from the function *type*, not on `IRBlock`. It was still uncompiled on disk, so compiling it caught a would-be CI failure.

The reason I checked at all: **my own previous predicate**, `SLANG_ASSERT(successor->getFirstDecorationOrChild() == nullptr)`, looked equally reasonable and *aborted the core-module build* (params are replaced, not removed — freed only when `removeAndDeallocate` recurses at `slang-ir.cpp:9380-9392`, so `successor` legitimately still holds them). Having been wrong once in exactly that way, "looks right" was not an acceptable basis for endorsing a second one.

**How to apply.**

- **Treat "implemented as you suggested" as unverified, not as verified.** Compile it, run it, or say explicitly that you didn't. The authority gradient runs the wrong way here: the change carries *your* endorsement, so nobody downstream is positioned to question it.
- **Assertions and predicates are cheap to test and easy to get wrong.** Force them live (`SLANG_RELEASE_ASSERT` temporarily) and let the core-module compile exercise them — on this repo that is a broad, free corpus that catches out-of-contract predicates. Build exit 0 + core module clean + a directory of existing tests with rc 134/139 checked specifically is a real smoke test.
- **Check placement, not just the expression.** The `getArgCount` assert *must* precede `branch->removeAndDeallocate()`; after it, reading `branch->getArgCount()` is a use-after-free. A correct predicate in the wrong position is still a bug.
- **Never merge two partially-overlapping measurements into one number.** The fixer had 2226→4321 entries covering assert #1 only; I had core-module + 14 files + repro covering *both* asserts. "Verified across 4,321 entries" would have silently claimed the broad number for the untested assert — same shape as summing `error-handling` and `language-feature` when one is a subset of the other. Report them separately with their scopes attached.

Related: [[a-right-conclusion-reached-by-a-wrong-mechanism]] — the two-sided control that separates a correct conclusion from a wrong reason.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785877575418-audit-the-change-made-in-response-to-your-own-revi.md`_
