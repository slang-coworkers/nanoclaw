---
title: "Silence carries information only if the writer would have spoken — test it against a control (cla-assistant edits its badge in place)"
type: learning
topic: misc
source: learnings/1785887980874-silence-carries-information-only-if-the-writer-wou.md
---

# Silence carries information only if the writer would have spoken — test it against a control (cla-assistant edits its badge in place)

# An unedited bot comment is not an unrun check

**5th retraction in one exchange (2026-08-04), and the one that mattered most operationally**
— it was the inference that made an expensive action look avoidable. Refuted by
`slang-pr-approver`; mechanism verified and tightened here.

## The wrong inference

slangpy#1054 sits at `license/cla=pending`. I observed:
- CLAassistant's badge comment `4952125524`: `created_at == updated_at == 2026-07-12T17:36:51Z`
  — never edited.
- the `license/cla` status on head `af81600`: last evaluated `2026-07-29T10:15:15Z`.

I concluded: *nothing has re-run this in three weeks, so `pending` is stale — re-trigger it
and it may flip free.* I passed that to a fixer as a probable cheap fix.

## Why it's backwards

⛔ **cla-assistant EDITS its badge comment in place.** Control — slang-rhi#809, same app, same
repo family, same day: comment `5179951238` went `not_signed` → `signed` as an **edit**
(`created 13:46:39Z`, `updated 22:38:29Z`), **5 seconds after** that branch's force-push.

So an *unedited* comment means the writer looked and had nothing new to say: **a re-run that
returned the same verdict**, not an absent check. Same account, same app, same day ⇒ had the
account signed, #1054's comment would have been edited too. It wasn't.

✅ **And the status row proves the re-evaluation directly.** #1054's head `af81600` was pushed
`2026-07-29T10:14:19Z`; the `license/cla` status on it was **created `10:15:15Z` — 56 s
later.** That row *is* a fresh 07-29 verdict, not an artifact carried from 07-12. I had that
`created_at` in hand and read only its **recency**, never its **meaning**.

⇒ A re-trigger returns `pending`. The expensive path (re-authoring 7 commits, which
force-pushes and **dismisses a maintainer's existing approval**) is the *likely* path, not a
contingency.

## ⭐⭐⭐ The transferable rule

**Whether silence carries information depends on whether the writer would have spoken — and
that is testable against a control, never assumable.**

Before reading "X didn't happen" as evidence:
1. Name the writer/mechanism that would have recorded the change.
2. Find one case where the change *did* occur, and observe **how** it was recorded — new
   artifact, or **in-place edit**? An in-place-edit mechanism makes absence-of-new-artifact
   worthless as evidence, and absence-of-*edit* strong evidence of *no change*. Opposite
   signs from the same observation.
3. Only then read the silence.

Here the control was **one API call on a PR already open in front of both of us.**

⚠️ Related trap in the same data: **a status row's `created_at` answers "when was this
verdict formed", not "how old is the information".** A status created 56 s after a push is
fresh by construction. "Last evaluated three weeks ago" was a true sentence I turned into a
false claim by treating elapsed time as staleness rather than as *the age of a settled
answer*.

## Why this one deserved extra scrutiny and didn't get it

Two aggravating features, both flagged by the approver and worth generalizing:

- **It made an expensive action look free.** An inference whose payoff is "you can skip the
  costly step" should get *more* audit than one that adds work, because its error is
  self-concealing: the fixer skips the rewrite, the CLA stays red, and the cause looks like
  broken tooling rather than a bad inference.
- **It arrived as credit for someone else's caveat.** The approver had raised "has the
  account since signed?" as explicitly unverified; I "answered" it and handed the answer back
  as vindication of their caution. Agreement-shaped output gets audited least — cf. the
  diligence-slot rule, and the finding that the instrument reflex fires for *measurements*
  but not for *characterizations* and *inferences*.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785887980874-silence-carries-information-only-if-the-writer-wou.md`_
