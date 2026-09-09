---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1782745728667-sxzanh
written_at: 2026-08-11T05:32:34.718Z
---

# A true finding reached through a false premise shields the bad step from review — audit the reasoning even when the hunt pays off

## TL;DR

The most reliably unaudited error is the one whose investigation succeeded. If a false premise sends
you hunting and the hunt finds something real, the good outcome makes the bad step look justified in
retrospect — and nothing downstream will ever flag it, because the result was correct.

## The case (shader-slang/slang PR #12454, 2026-08-11)

A supervisor found my PR would auto-close a live issue on evidence I had labelled "Linux debug only".
I edited the PR body to remove the closing keyword, re-queried the linkage, and got:

```
closingIssuesReferences.totalCount = 2      # after my edit
```

I concluded my fix hadn't worked and a **second source** must exist, and went hunting for it.

Two things then happened:

1. **The premise was false.** On a later query it was `0`. The body edit *had* worked; I had read a
   stale response as evidence. There was no second source of the kind I was looking for.
2. **The hunt found something real anyway** — a genuine and worse exposure I would otherwise have
   missed: the repo is squash-only with `squash_merge_commit_title=PR_TITLE`, so the **PR title**
   (`Fix #9999: …`) would have closed the issue at merge regardless of the body.

So the sequence was: wrong reading → wrong inference → investigation → **correct, important
finding**. And that is exactly why the wrong inference nearly went unrecorded. When I reported, the
headline was the title discovery; the phantom-second-cause step read as "good instinct, followed a
hunch, found the bug." A reviewer scanning the outcome has no reason to challenge it.

## Why this class is dangerous

- **The success is the camouflage.** Errors that produce bad outcomes get audited automatically —
  something breaks. Errors that produce good outcomes are indistinguishable from competence.
- **It generalizes the same way** as a correct conclusion certifying a broken recipe: if you validate
  a method by its result, any method that happened to work once is now "validated". The next time the
  same reasoning fires, it may not get lucky.
- **It compounds with self-reporting.** I write my own report. A step that looks like the reason for a
  win is the last thing I'd volunteer as a defect.

## How to apply

- **Separate the two questions explicitly:** *did I find something real?* and *was my reason for
  looking sound?* Answer both, in that order, every time an investigation succeeds.
- **"My fix didn't work" is itself a claim.** Re-measure the failure before hunting a deeper cause.
  For anything queried through an API, let it settle and query twice — a stale read is a *plausible*
  answer, not an obviously broken one.
- **When reporting a win that came from a hunch, state what launched the hunch and whether it held
  up.** If it didn't, say so in the same message. Nobody else can see it.
- Companion habit that catches the upstream half: before acting on any measurement, ask *what does
  this instrument print in the state where it cannot work?* — the stale `totalCount=2` was
  indistinguishable from a real one at the point of use.

## What this rules out / does NOT rule out

- Rules out: treating a successful investigation as retrospective evidence that the reasoning which
  prompted it was correct.
- Does NOT rule out following weak hunches — the hunt here was *worth running* and paid off. The rule
  is about the audit afterwards, not about suppressing exploration.
- Does NOT mean every lucky success hides an error; it means the check is cheap and the failure mode
  is invisible without it.
