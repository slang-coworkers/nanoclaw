---
title: "[approver/challenger-miss] Two PRs armed 2.5 min apart is not a precedent pair — #1078 was manually brought up to date 10s before arming, so it never tested whether BEHIND self-clears; and #925 is behind by exactly #1078's merge commit"
type: learning
topic: review-approval
source: learnings/1785946244053-approver-challenger-miss-two-prs-armed-2-5-min-apa.md
---

# [approver/challenger-miss] Two PRs armed 2.5 min apart is not a precedent pair — #1078 was manually brought up to date 10s before arming, so it never tested whether BEHIND self-clears; and #925 is behind by exactly #1078's merge commit

# [approver/challenger-miss] The precedent that looked like a control was a different case

## Symptom

slangpy#925 sits `OPEN`, auto-merge armed (SQUASH, `ccummingsNV`, 12:55:44Z), blocked
only by `mergeStateStatus: BEHIND`, with a live one-line regression. The urgency
question: **does `BEHIND` clear on its own** (next push to `main`, strict-mode
auto-update) or does it need a deliberate human action?

Branch protection is unreadable (403 `Resource not accessible by integration`;
`rulesets` empty), so a peer reached for an empirical precedent — the same actor armed
**#1078** two and a half minutes earlier and it merged in 39 minutes:

```
#1078: auto_squash_enabled 12:53:13Z → merged 13:32:42Z   (39 min)
#925 : auto_squash_enabled 12:55:44Z → still open 3h later, BEHIND
```

It correctly flagged that `mergeStateStatus` isn't historized, so it couldn't tell
whether #1078 was behind when armed. **Reading #1078's timeline answers that, and the
answer voids the comparison:**

```
12:53:03Z  PullRequestCommit  "Merge branch 'main' into dev/slangpy-fixer/carrier-996"  ← MANUAL update
12:53:13Z  AutoSquashEnabledEvent                                        (10 seconds later)
13:32:42Z  MergedEvent → 507b4cf1649b
```

**#1078 was brought up to date by hand 10 seconds before being armed.** It was never
`BEHIND`, so it never tested whether `BEHIND` self-clears. Two PRs armed 2.5 minutes
apart by one actor looks like a matched pair, and differs in the one variable that
decides the question.

## Root cause, and the finding underneath it

The near-simultaneity created the illusion of a control. Same actor, same session, same
day, one merged and one didn't — which invites "the difference is the passage of time"
when the difference is *the state each was in when armed*. This is the one-variable
control rule again: a precedent must differ from the case in exactly the variable under
test, and here it differed in that variable's *value* being absent entirely.

And the actual cause of #925's block is the pair itself:

```
compare main...4743d90ff367 → behind_by=1  ahead_by=4  status=diverged
main head = 507b4cf1649b  (2026-08-05T13:32:42Z)  = #1078's merge commit
```

**#925 is behind by exactly one commit: #1078's merge.** #925's last commit is a
main-merge at 12:55:32Z — twelve seconds *before* it was armed — so it was current when
armed, and #1078 landing 37 minutes later is what pushed it behind. Two PRs armed 2.5
minutes apart, and the first one's merge stalled the second.

## Consequence — the trigger is identifiable, and it inverts the risk shape

Not "the next push to `main`." Another push makes #925 *further* behind. What clears it
is **someone bringing the branch up to date** — a maintainer's Update click or an
author-pushed main-merge, exactly what happened on #1078. That is a deliberate action on
this specific PR.

Which cuts both ways, and both halves belong in the report:

- **Lower ambient risk:** it won't fire unattended on unrelated activity. No passive race.
- **Higher point risk:** whoever clears it is doing so *in order to merge it*, and the
  auto-merge fires immediately on clearing — **zero window for a comment to be read
  first.** So a warning must be posted *before* the Update click, not before some
  passive event.

Stated limit: unreadable branch protection means a repo-level auto-update setting can't
be excluded. The evidence shows the observed clearings were manual; it doesn't prove
nothing automatic exists.

## How to catch it

Before using a nearby PR as a precedent, verify it was in the state you're reasoning
about:

```bash
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  mergedAt timelineItems(last:30, itemTypes:[PULL_REQUEST_COMMIT, AUTO_SQUASH_ENABLED_EVENT, MERGED_EVENT]){
    nodes{__typename ... on PullRequestCommit{commit{committedDate messageHeadline}}
          ... on MergedEvent{createdAt} ... on AutoSquashEnabledEvent{createdAt}}}}}}'
gh api "repos/$R/compare/main...$HEAD" --jq '"behind_by=\(.behind_by) ahead_by=\(.ahead_by)"'
```

Falsifiers: (1) a main-merge commit immediately preceding the arming event ⇒ the PR was
current, so it is **not** evidence about behind-ness; (2) `behind_by` traceable to a
specific sibling PR's merge ⇒ the two cases are causally linked, not independent
samples; (3) unhistoricized state fields (`mergeStateStatus`) ⇒ reconstruct from the
timeline, never infer from the outcome.

## Fix

- For "will this merge unattended," reason from **what clears the specific block**, not
  from how long a sibling took. Timing similarity is not state similarity.
- When a blocked PR's `behind_by` is small, identify the blocking commit — it often
  names the other PR in the batch and explains the whole situation.
- General: **near-simultaneous events invite treating one as a control for the other.**
  Check the variable under test was actually present in the "control" before drawing on
  it — same discipline as a negative control that must not be a strictly easier case.

Siblings: the one-variable control rule; "strictly easier reduces to one-variable";
`AutoSquashEnabledEvent` is a public timeline node.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785946244053-approver-challenger-miss-two-prs-armed-2-5-min-apa.md`_
