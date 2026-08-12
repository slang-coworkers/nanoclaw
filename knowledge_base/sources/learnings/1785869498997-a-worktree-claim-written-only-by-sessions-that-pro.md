# A worktree claim written only by sessions that PROCEED leaves the collision hole open — and CHANGES_REQUESTED is sticky, pinned to a commit

# Two sessions nearly edited one branch, and the only detector was "notice unfamiliar reflog entries"

Dispatched to work PR #11709 (`fix/issue-10641`) as *"the one with actual work owed."* Two findings, both
about reading state rather than about the code.

## 1. The collision was detectable only by luck

`active-work/slang-10641` did not exist — the peer session never claimed the target. So the sentinel
protocol, which exists precisely to prevent two sessions on one tree, gave **no signal**. What surfaced it
was reflog forensics:

```
18:41:34  commit (amend): Honor `[noinline]` on a function with a `__ref` parameter
18:35:47  reset: moving to HEAD
18:31:20  commit: Honor `[noinline]` …
16:04:29  commit: Lower a `const groupshared` parameter …
15:21:17  merge origin/master
```

An **amend eight minutes before I looked** — mid-work, not finished. I had committed nothing in that
worktree this session, so the entries were identifiably not mine.

⭐ **That detector worked by luck: the peer's commits were recent and distinctively titled.** It fails
silently whenever the other session's work is older, or its messages resemble what you'd write yourself —
which, between sessions of the same agent, is the normal case.

**The structural defect: a claim written only by sessions that proceed cannot prevent collisions.** If
`mkdir active-work/<target>` happens *after* deciding to work, then any session that starts, pauses, or
works without claiming is invisible. The claim has to be unconditional and early — before the first edit,
not after the decision. Corollary for the reader: **absence of a sentinel is not evidence the target is
free.** Check the worktree's reflog and `git log` dates against your own session history before touching it.

**On finding a collision: abort, don't hold.** Standing rule, and it's right — stop anything you started,
report, end the turn. Do not wait for the peer to stand down, and do not "just finish this one bit." Two
sessions on one branch is strictly worse than either alone, and holding replays full context per turn to
accomplish nothing.

## 2. `CHANGES_REQUESTED` is sticky and pinned to a commit — currency ≠ classification

The dispatch said work was owed because `reviewDecision == CHANGES_REQUESTED`. Measured:

```
CHANGES_REQUESTED  2026-07-02  @ 2e338d3429
CHANGES_REQUESTED  2026-07-30  @ 60cbe93ca1     ← newest review
head                            b7307a34cc      ← 5 commits, 5 days later
```

Plus three commits landing *after* the last review, one titled exactly what the reviewer had asked for.

**`CHANGES_REQUESTED` persists until the reviewer re-reviews, regardless of what lands afterward.** So the
state at the current head means *a review happened*, not *something is presently owed*. The correct read
was **answered-and-unre-reviewed**: what it needs is a re-review request, not new work.

⇒ **A review is a claim about a specific commit, exactly like a check run.** Always read `commit_id` and
compare it to the head. This is the same instrument that, applied to `check-runs` earlier the same day,
showed two "failures" were superseded re-runs at one sha — and it went unapplied to reviews an hour later
by the same reader. **A timing gap, not a knowledge gap: the rule was known and the field was not
inspected.** The remedy for that class is never "read more"; it is a check that fires where the state is
consumed.

## 3. Cross-thread routing can silently strand the context you need

The dispatch referenced *"my previous message has the detail"* — a message that had gone out on a
**different thread** than the PR's own chain, so it never reached the session being asked to act. I
reconstructed the target by inference (`#11709` → its title `Fix #10641` → my existing `fix-10641.md` and
`wt-slang-10641`), which worked but is recovery, not routing.

**Status about an issue or PR must carry that chain's thread id.** Folding commentary about issue A into a
message on issue B's thread means the session that owns A cannot see it — and the failure is silent on both
ends.
