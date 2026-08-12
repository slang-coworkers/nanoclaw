---
title: "[approver/challenger-miss] I inferred maintainer availability from OPERATOR absence — two different parties, and only the one that doesn't matter is measurable from here; also: a conclusion propped up by a bad reason plus a good one is exposed, because the bad reason is what gets quoted"
type: learning
topic: review-approval
source: learnings/1785950168336-approver-challenger-miss-i-inferred-maintainer-ava.md
---

# [approver/challenger-miss] I inferred maintainer availability from OPERATOR absence — two different parties, and only the one that doesn't matter is measurable from here; also: a conclusion propped up by a bad reason plus a good one is exposed, because the bad reason is what gets quoted

# [approver/challenger-miss] Two absences, one word, no connection

## Symptom

An `ask_user_question` to our operator timed out at 300s. I reasoned:

> if the operator is away, then the *Update branch* click is also unlikely in that window —
> the same absence that prevented the decision reduces the risk the decision was about.

**Wrong. The operator and the person who clears slangpy#925 are different people.** The
clearer is `ccummingsNV` (armed the auto-merge, pushed both main-merges); the operator is our
dashboard user. Operator silence is evidence about **our** side and says nothing about
maintainer availability.

The maintainer's actual availability *is* measurable, from his own event stream — 11
`ccummingsNV` events in slangpy today, clustered 12:53-13:32Z, then quiet for ~3h40m. So the
real observation exists, but it comes from a different artifact than the one I used.

## Root cause

Two independent variables shared one English word — "away" — and I let the word do the
coupling. Same family as the two-artifacts trap (*two files, one path fragment*; *two heads,
one PR*; *two policies, one version string*), but about **actors** rather than files: two
absences, one term, and only the irrelevant one was in front of me.

Test that would have caught it: **name the parties.** "Operator away ⇒ maintainer won't
click" reads plausibly; "dashboard-user away ⇒ ccummingsNV won't click" is obviously a
non-sequitur. When an inference chains across a shared attribute, substitute the concrete
identities and see whether it still parses.

## The sharper half (my peer's, and it generalizes further)

The decision I was propping up — *default to not posting* — was already correct on its own
grounds: the finding is public (collapsed, but on the PR), and not posting forfeits nothing
irreversible. So I added a bad reason to a conclusion that didn't need it.

> **A conclusion supported by a bad reason and a good reason is still exposed, because the bad
> reason is the one that gets quoted.**

That inverts the instinct to pile on support. Shoring up a sound asymmetry with a timing
coupling that doesn't exist makes the whole thing refutable by attacking the timing — and the
sound part gets discarded with it. **State the load-bearing reason alone.** Corollary for
review work: when I catch myself adding a second justification, check whether the first was
already sufficient; if so, the second is a liability, not reinforcement.

## Fix

- Default unchanged (don't post) — it never rested on timing, which is exactly why it survived
  the correction.
- For any availability/timing inference: **identify the party who actually performs the
  action**, and measure *that* party (`gh api users/<login>/events/public`, or repo events
  filtered by actor). Our own side's presence is almost never the relevant signal.
- Sender-side pairing from the same exchange: **three identical outbound pings is a signal to
  re-check who can act, not to wait longer.** A restatement that adds nothing means the
  recipient isn't the blocker.

Siblings: the two-artifacts entries (policy files, decided heads, `file:line` across parallel
trees); "a retraction is not self-verifying"; the sayability entry — the coupling was *more
sayable* than the asymmetry, which is why it got written.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785950168336-approver-challenger-miss-i-inferred-maintainer-ava.md`_
