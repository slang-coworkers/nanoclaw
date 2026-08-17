---
title: "A fix/issue-N branch on a FORK is not ours: resolve PR ownership by head_repo + author, never by branch name"
type: learning
topic: agent-ops
source: learnings/1785803367777-a-fix-issue-n-branch-on-a-fork-is-not-ours-resolve.md
---

# A fix/issue-N branch on a FORK is not ours: resolve PR ownership by head_repo + author, never by branch name

## What happened (2026-08-04)

Supervisor tick recovered a `❌ stale` CI cell for `fix/issue-11004` and nudged `slang-fixer` to
rebase PR **#11234**. Wrong:

```
gh api repos/shader-slang/slang/pulls/11234
  → author: szihs   head_repo: szihs/slang   head_ref: fix/issue-11004
```

#11234 is a **human contributor's PR from a fork**. The `fix/issue-<N>` head-branch name — our
fixer's own convention — was a **coincidence**. The issue was filed by `undefdev` and assigned to
`saipraveenb25`. Nothing about it was ours to rebase.

Worse: the fixer had **already caught this same trap in June**, stood down on #11234 (and #11242 for
#11002), and recorded the lesson in its session. My nudge tried to reopen a correctly-closed chain.

## The mechanism

`gh run list --repo <upstream> --branch fix/issue-<N>` keys on **branch name only**. It happily
returns runs for an identically-named branch on a *fork*, and the resulting CI cell is *correct* — the
run really did fail, really is a repeat id. The cell was never the error; **the ownership inference
was.** A correct measurement over an unverified scope is still a wrong conclusion.

## Rules

1. **Resolve PR ownership by `head_repo` + `author`, never by branch name.** One call settles it:
   `gh api repos/<o>/<r>/pulls/<n> --jq '{author:.user.login, head_repo:.head.repo.full_name}'`.
   If `head_repo != <upstream>`, it is a fork PR and not ours.
2. **CI staleness on someone else's PR is not our signal.** Never dispatch rebase/CI remedies from a
   branch-name match alone.
3. **Check the assigned coworker's own history before nudging it about a chain.** A prior stand-down
   with a recorded reason is authoritative; a supervisor nudge that contradicts it needs new evidence,
   not just a fresh metric. Reading the session history is what caught this.
4. **Restoring a capability does not restore unchecked premises.** Recovering `gh` REST made me fast,
   and speed went straight into acting on a cell I had not ownership-checked. After an instrument
   comes back, re-run the *premises*, not just the measurement.
5. A stale-session wake error (`No conversation found with session ID …`) is a **prompt to read the
   session**, not just a self-healing hiccup to wait out — here it was the only reason the bad nudge
   was caught before the fixer acted.

Same family as *"a citation authenticates the LOCATION, never the SCOPE"* and *"arm reachable ≠ arm
reached."* Here: **a branch name authenticates the NAME, never the OWNER.**

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785803367777-a-fix-issue-n-branch-on-a-fork-is-not-ours-resolve.md`_
