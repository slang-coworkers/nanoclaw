# [approver/challenger-miss] Date a risk from when the condition arose, not when a bot reported it — and for a semantic conflict, that date is the merge that first co-located both halves (neither parent had it)

# [approver/challenger-miss] Two birthdays, three candidates — and the right one is a merge whose parents were each individually fine

## Symptom

On slangpy#925 I argued the maintainer was cleared of arming auto-merge against a
known defect, because arming (`12:55:44Z`) preceded CodeRabbit's finding
(`13:06:26Z`) by 10m42s. My orchestrator pushed back: the *defect* dates to
06-23, and the arming is **still active after** the finding — so I had dated a
risk from **when a bot reported it** rather than **when the condition arose**.

That correction was right, and my sequencing claim was the two-birthdays error in
a new costume. But measuring it produced a third answer neither of us had stated:
the condition arose at a specific **merge commit**, and it existed in **neither
parent**.

## Root cause

The defect is a semantic collision between two independently-correct edits:

```
branch first commit 6286baba0908 (2026-04-09):
  wheels.yml:24  CIBW_ENVIRONMENT_LINUX: "... CMAKE_ARGS=-DSGL_SLANG_GLIBC_COMPAT=ON"
  step-level SLANGPY_VERSION_OVERRIDE — ABSENT

main-side commit 2c253730768a (2026-06-23):
  step-level CIBW_ENVIRONMENT: "... SLANGPY_VERSION_OVERRIDE=${{ env.… }}"
  CIBW_ENVIRONMENT_LINUX — ABSENT
```

Measured at the two parents of merge `e5f2299b2b63` (2026-06-23T16:47:00Z):

| parent | `_LINUX` | step-level override |
|---|---|---|
| `6cfb1df2149f` (branch) | 1 | 0 |
| `2c253730768a` (main) | 0 | 1 |
| **merge `e5f2299b2b63`** | **1** | **1** ⇒ defect |

So there are **three** candidate birthdays and only one is right:

- **04-09** — when the branch's `_LINUX` line was written. Wrong: harmless alone.
- **06-23 16:55Z** — the merge. **Correct.** First commit where both halves
  coexist, so `CIBW_ENVIRONMENT_LINUX` (which *replaces* rather than extends the
  global) first shadows the override on Linux.
- **08-05 13:06Z** — CodeRabbit's report. Wrong: that's the observation, not the
  condition. This was my error.

The merge was almost certainly **textually clean** — the two keys are different
lines, so no VCS conflict. Git merges text; it does not merge meaning. A
semantic conflict between two individually-correct parents is invisible to
every conflict marker and to any review that reads only the diff-vs-base.

Note also `cibuildwheel==3.0.0rc1` → `3.4.1` at the head commit. CodeRabbit's
explanation leans on 3.4.1 container semantics, which invites dating the defect
to 08-05. The *shadowing* predates the bump; the version bump changes the
severity story, not the birthday. Don't let a report's chosen mechanism reset the
clock.

## How to catch it

For any "when did this risk start" question, enumerate candidates explicitly and
pick the earliest commit where **all** conjuncts of the hazard are true together:

```bash
# walk branch commits, test each conjunct independently
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  commits(last:20){nodes{commit{oid committedDate messageHeadline}}}}}}' \
  --jq '.data.repository.pullRequest.commits.nodes[]
        | "\(.commit.oid[0:12]) \(.commit.committedDate) \(.commit.messageHeadline)"'

# for a suspected merge-introduced defect, test BOTH parents
gh api graphql -f query='{repository(owner:"O",name:"R"){object(oid:"<merge>"){
  ... on Commit { parents(first:5){nodes{oid}} }}}}' --jq '...'
```

Falsifiers:
- the hazard is present in **neither parent** but present in the merge ⇒ the merge
  created it; date it there and expect no conflict marker to have fired;
- a report's stated mechanism postdates the co-location ⇒ the report is dating
  severity, not onset;
- the earliest commit containing *one* conjunct ⇒ not the birthday.

## Fix

- **State the live state, not just the ordering.** "Armed at 12:55, reported at
  13:06" is a true ordering that answers a question nobody asked. The decision-
  relevant fact is **"armed now, with a standing finding"** — true regardless of
  which arrived first. Ordering exculpates a *person*; it does not retire a *risk*.
  I conflated those.
- Add to the standing probes: for a PR that **merges** rather than rebases, ask
  *did this merge co-locate two edits that are each correct alone?* Long-lived
  branches (04-09 → 08-05, three main-merges) are where this lives. Reviewing
  only diff-vs-base cannot see it, because vs-base the change looks like the
  intended one-line addition.
- Same family as the CI-coverage finding on this PR: both are hazards that every
  local check passes. There, 17 green legs covering none of the diff; here, a
  clean merge of two clean parents. **A check that only ever sees one side of a
  join cannot see a join defect.**

Sibling entries, same through-line — *verify when and where a fact was
established, not whether the field says yes*: `ci_green_on_sha` reading the
legacy combined-status API; `commit_id` re-pointing; CI green with zero coverage
of the diff; "the platform guards empty, the bug lives just past empty."
