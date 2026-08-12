# Two dispatches to one child: check for starvation, because silence reads identically to progress

# Starvation signature: the later dispatch overtook the earlier one

**Observed 2026-08-04, shader-slang/slang#11917 pass-gating epic.**

Two batches were dispatched to the same child (triager→fixer) two days apart:
- **batch-2** (4-pass gating) dispatched 07-28 → **no branch, no PR, 7 days later**
- **batch-3** (2 passes via in-pass scan) dispatched 07-30 01:12 → **PR #12281 opened 07-30 03:17 (~2h), pdeayton APPROVED 08-03**

The later dispatch completed in ~2 hours. The earlier one produced nothing. The issue author asked
about batch-2 **twice** (07-28, then 08-04) before anyone noticed.

## Why it stayed invisible

Every tier behaved "correctly" by its own local rule:

1. The child reported "fixer building draft PR, no PR# yet" — plausible, and true at the time.
2. I **relayed that upward without verifying**, then adopted the "hold for `[Fix Report]`
   without polling" discipline.
3. That discipline is right for suppressing noise — but **it has no deadline**. Nothing in it
   ever asks *"has too long passed?"* So a dropped handoff and healthy in-progress work emit
   **exactly the same signal: nothing.**

The starvation was only found because a **repeat** status question from the requester triggered a
ground-truth check (`git/matching-refs/heads/<prefix>` + `is:pr <issue> in:title`), which showed
the branch had never been created.

## Rules

- **When two dispatches are in flight to one child, explicitly check for starvation.** Do not
  assume FIFO. Ask which one produced an artifact — a later task completing is positive evidence
  the child is alive, which makes the earlier one's silence *more* suspicious, not less.
- **A repeat question about the same artifact is a starvation alarm.** Being asked twice means
  your last answer didn't hold. Never re-relay "still building" — verify the artifact exists first.
- **Pair every silent-hold with a staleness bound.** "Hold without polling" must carry an implicit
  *"…and if N days pass with no artifact, verify."* Silence-is-fine and silence-is-a-bug are
  indistinguishable without a clock.
- **Verify a child's in-progress claim before relaying it upward** — same rule as verifying a
  diagnosis. "Building the PR" is a factual claim about the world with a cheap check:
  does the branch exist? does a PR reference the issue?

## The cheap ground-truth checks

```bash
# Does the branch exist at all? (REST — works when `gh pr list` GraphQL 401s)
gh api "repos/O/R/git/matching-refs/heads/fix/issue-<N>" --jq '.[] | "\(.ref)  \(.object.sha)"'

# Any PR in ANY state referencing the issue?
#   → MCP: github_search_issues q="repo:O/R is:pr <N> in:title"

# Is a found branch real work or a stale leftover?
gh api "repos/O/R/compare/master...<sha>" --jq '"status=\(.status) ahead=\(.ahead_by) behind=\(.behind_by)"'
```

A branch that is `diverged` and hundreds of commits `behind` is an **old** slice, not the new one —
matching the name prefix is not enough. (`fix/issue-11917` looked like a hit but was the merged
#11920 slice from a month earlier, 208 behind master.)

## Related

Fits the same family as "a stalled handoff is not queued / will not self-heal — if you own the
chain, chase it." The addition here: **you cannot chase what you cannot see, and a silent-hold
rule with no deadline guarantees you won't see it.**
