---
title: "COMMENTED ≠ CHANGES_REQUESTED: maintainer comments on an approved PR do not authorize dismissing another maintainer's approval"
type: learning
topic: review-approval
source: learnings/1785866765386-commented-changes-requested-maintainer-comments-on.md
---

# COMMENTED ≠ CHANGES_REQUESTED: maintainer comments on an approved PR do not authorize dismissing another maintainer's approval

# Five maintainer review comments arrived on an already-approved PR. Pushing the fixes would have been wrong.

shader-slang/slang PR #12281. State at the time:

```
pdeayton-nv  APPROVED    commit=54f357b8f8de  2026-08-03T23:11Z
jkwak-work   COMMENTED                        2026-08-04T17:53Z   (5 comments)
head=54f357b8f8de  draft=false  merged=false
```

Four comments asked for source-comment removals; one raised a technical question. My instinct was that
five maintainer comments *constitute* a change request in substance, so the obvious move was to fix them
and push. **That would have been wrong**, and the reason is a formal-state distinction, not a judgement
call:

⭐ **`COMMENTED` is a deliberate non-blocking state.** A maintainer who wanted to block had
`CHANGES_REQUESTED` available and did not use it. So nothing was formally requesting a change — and
because approvals are pinned to a commit SHA, **any push would dismiss a different maintainer's live
approval in order to satisfy comments that were explicitly filed as non-blocking.** The second maintainer
may not even have noticed the approval was there.

**The correct move: reply-only, and ask.** Concede the requests, say the changes are ready, then state the
conflict plainly — *"pushing would dismiss pdeayton's approval on the current head; since your review is
COMMENTED rather than CHANGES_REQUESTED, I didn't want to trade that away on my own initiative. Happy to
push now if you prefer, or hold it and fold it into a later revision."* That costs nothing, gives a full
response, and leaves a human to decide which artifact to spend.

**Check before acting on review feedback on an approved PR:**
1. What is the *formal* review state of the new feedback — `COMMENTED`, `APPROVED`, `CHANGES_REQUESTED`?
2. Is there a live approval, and which commit SHA is it pinned to?
3. Are the two reviewers the same person? (If a different one, they may be unaware of each other.)
4. If a push would dismiss an approval to satisfy non-blocking feedback — **ask, don't infer.**

## Related trap in the same exchange: don't defend a test, test the suggestion

The maintainer suggested the test might not need a flag it was passing. I had drafted a reply saying his
alternative would "exercise a different path" and thus weaken the test. An independent critique challenged
that, so I **built the variant and measured**: the alternative retained and legalized the same function
(16 dump mentions, target IR shape present). My claim was simply false, and posting it would have told a
core maintainer his suggestion broke something when it didn't.

**A reviewer's suggested alternative is a testable hypothesis, not a proposal to argue with.** Build it
before characterizing it — especially before characterizing it *negatively* in public.

## And a third stdout/stderr miscount in one session

My evidence table had a single "stdout" column, but the generated code goes to **stdout** while
`-dump-ir-*` output goes to **stderr** — so the dump column reported stderr under a stdout heading. Third
time in one session a stream split produced a wrong reading (see also
[[slang-test-prints-100-of-tests-passed]], where the failure notice is on stderr and the misleading
percentage on stdout). **When a tool writes two kinds of output, establish which stream each uses before
building a table whose columns imply it.**

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785866765386-commented-changes-requested-maintainer-comments-on.md`_
