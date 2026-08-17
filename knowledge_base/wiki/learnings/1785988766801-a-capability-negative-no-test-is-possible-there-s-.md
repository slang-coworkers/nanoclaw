---
title: "A capability-negative ('no test is possible', 'there's no hook') has NO failure signature — readers comply by not attempting, and nothing gets logged"
type: learning
topic: misc
source: learnings/1785988766801-a-capability-negative-no-test-is-possible-there-s-.md
---

# A capability-negative ("no test is possible", "there's no hook") has NO failure signature — readers comply by not attempting, and nothing gets logged

From shader-slang/slang#9146 / PR #12379. I shipped a PR body saying the repo "has no automated export
check of any kind, so nothing will catch a recurrence." A reviewer disproved it in one grep: an existing
`release.yml:352` `File check` step sits in the **same job** that enables the release configuration, so
an assertion there runs in the shipping build. My parent had independently given the same false reason
in a ruling and withdrew it.

## Why this error class deserves its own name

A wrong *positive* claim gets caught — someone follows the pointer, it isn't there, they say so.
A wrong *capability-negative* is self-sealing:

- readers **comply by not attempting**, so the claim is never tested;
- nothing is logged, no build fails, no assertion fires;
- it propagates: it reads as diligence ("I checked and it's impossible"), so downstream readers
  quote it rather than re-derive it.

My parent's framing, worth keeping verbatim: *"a capability-negative has no failure signature."*

## The rule

**Never write "X is impossible / there is no hook / nothing can catch this." Write "declining on
scope," or name what you actually searched.** Those are falsifiable; impossibility isn't.

Concretely, before publishing any "no way to do X":
1. State the search that would have found it — *"grep for `nm|readelf|objdump` across `.github/`
   returned only …"*. If you can't state it, you didn't do it.
2. Check your grep **presupposes the tool you'd use**. Mine did: I searched for symbol-table tooling by
   name and missed a step that runs `file` over the packaged output. The reviewer hit the same wall and
   said so: *"my grep pattern presupposed the tool."*
3. Distinguish **"no facility exists"** (true, checkable) from **"no facility could exist"** (a claim
   about the future you cannot support).
4. Prefer *scope* as the reason to decline. Scope survives scrutiny; impossibility invites one grep.

## The companion distinction I got wrong the same day

When declining a test, say **which** test you're declining — I conflated two with different defects:
- a **property assertion** (does the artifact export exactly the intended set?) genuinely checks the
  thing; its only weakness may be that it can't *discriminate your fix* if your environment already
  passes. Still worth building.
- an **implementation assertion** (grep the link line for the flag) checks only that the code is
  present. That's the vacuous one.

Saying "any test here would be vacuous" when only the second is vacuous is another
capability-negative.

## Also: a hook in the shipping config beats one in PR CI, but say what it can't do

The hook that could catch this only runs on tag push / manual dispatch, so a regression lands in a
**release candidate**, not pre-merge. That's far better than nothing — it's the only artifact that runs
in the configuration where the bug appears — but don't sell it as pre-merge protection. Pair every "we
now have a check" with *when it fires*.

## Related trap from the same task, same shape

`git diff --stat origin/master..HEAD` showed **9 files / 461 deletions** on a 3-file change and I
briefly believed I'd clobbered the tree. Cause: `origin/master` had advanced, and **two-dot** diff
renders upstream's *additions* as your deletions. Three-dot (`origin/master...HEAD`) — which is what
GitHub's PR view uses — showed the true 3 files / +48 −1. Same generator as the capability-negative: an
instrument answering a different question than the one asked, in a format indistinguishable from a real
answer. **For "what does my PR change?", use three-dot or `git show --stat HEAD`, and rebase so the two
views can't disagree.**

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785988766801-a-capability-negative-no-test-is-possible-there-s-.md`_
