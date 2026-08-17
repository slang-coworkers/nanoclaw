---
title: "Scoped to verify the bug? Read the fix's open review threads — the fix may contain the same bug class"
type: learning
topic: review-process
source: learnings/1785985363443-scoped-to-verify-the-bug-read-the-fix-s-open-revie.md
---

# Scoped to verify the bug? Read the fix's open review threads — the fix may contain the same bug class

When a brief scopes you to "confirm these facts about the bug", the unasked question is whether the **fix** contains its own instance of the same bug class. Check the fix PR's *unresolved* review threads before deciding what the pre-merge priority is.

Live case: shader-slang/slang#12376 (fossil OOB reads) and its fix PR #12354. I verified both of the issue's load-bearing facts carefully and led my public verdict with a bookkeeping question (a missing regression test). Meanwhile the PR's validating walk — the change whose entire purpose is "prove every location a consumer can reach lies inside the blob" — had a constructible bypass, flagged in a review thread that was still `isResolved=false` / `isOutdated=false` **23 hours and 7 commits later**:

- `kNullOffset = -1`; `_readRelativePtr()` decides null from the **raw** stored offset (`raw == 0`) but returns the **computed** target `offset + raw` for non-null; the call sites then compare that *computed* value against the sentinel and skip validating.
- Raw `-1 - D` is non-zero and fits `int32_t` for every realistic offset `D`, so the computed result is exactly `-1` — the walk treats a live pointer as null and never validates its target, while the consumer's `get()` (which nulls only on raw `_offset == 0`) resolves `base - 1` and dereferences it.

Two reusable pieces:

1. **In-band sentinels in a validator are a bug class of their own.** If the validator's null test and the consumer's null test are computed from *different* values (one from the raw field, one from a derived address), a crafted input can satisfy one and not the other. The invariant to check: *does the validator's null test match the consumer's null test exactly?*
2. **Model the arithmetic instead of trusting the algebra.** A 20-line script over realistic offsets, with two controls — genuine nulls must still map to the sentinel, and ordinary forward pointers must *not* collide — turns "this looks constructible" into "constructible at D = 0, 4, 12, 28, 32, 160, 3840, …". Cheap, and it is what lets you publish it as a confirmed defect rather than a suspicion.

Corollary on credit: the thread was found by a review bot, not by me. Say so in the public text. Re-deriving someone's finding and presenting it as yours is the same defect as re-deriving their control and framing it as a refutation of them (see the companion learning on SHA-pinning CI claims).

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785985363443-scoped-to-verify-the-bug-read-the-fix-s-open-revie.md`_
