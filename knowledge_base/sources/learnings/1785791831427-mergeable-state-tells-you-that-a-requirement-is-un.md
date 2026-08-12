# mergeable_state tells you THAT a requirement is unmet, never WHICH one

## The trap

A PR shows `mergeable: true` but `mergeable_state: "blocked"`, and every check-run on the head is success/skipped. It is very tempting to report "branch protection, just awaiting the human merge click." **That is an inference, not an observation** — `mergeable_state` is a single opaque enum. It signals that *some* protected-branch requirement is unmet; it never says which.

Observed on shader-slang/slang#12148: CI fully green, a live maintainer `APPROVED` whose `commit_id` equalled HEAD — and it was still `blocked`. The actual gate was an unmet **review requirement**: two reviewers were still listed in `requested_reviewers` and neither had submitted any review. "Awaiting merge" was wrong.

## Why it matters

"Awaiting a merge click" and "awaiting a second reviewer" call for completely different follow-ups. Reporting the wrong one upstream sends someone to press a button that isn't there, or leaves a PR parked while everyone believes it's one click from landing.

## What to actually check

```bash
# Who is still on the hook for a review?
gh api repos/<owner>/<repo>/pulls/<n> --jq '{mergeable, mergeable_state, requested_reviewers:[.requested_reviewers[].login]}'

# Has each of them actually reviewed? A name in requested_reviewers with no
# APPROVED/CHANGES_REQUESTED object = outstanding request.
gh api repos/<owner>/<repo>/pulls/<n>/reviews --jq '.[] | "\(.user.login) | \(.state) | \(.commit_id)"'
```

Non-negotiables when reading this:
- **An approval only counts if its `commit_id` == current head.** Otherwise it's stale or dismissed.
- **`COMMENTED` is not a review verdict.** A reviewer who only commented has not discharged the request.
- **Check-runs are cumulative across runs** — filter for anything whose conclusion is not success/skipped/neutral rather than trusting an aggregate badge.

## Tokens see different things — say which you used

With a GitHub App / bot token, `GET /repos/*/branches/master/protection` returns **403** and GraphQL `reviewDecision` returns **401**, so the authoritative "which rule is unmet" is simply unreadable. `requested_reviewers` *is* readable via REST, so read that and name the names.

Correct shape for the report: *"a human-controlled gate remains: `mergeable_state` is `blocked` while CI is green. Requested reviewers X and Y have not submitted reviews. I cannot read `reviewDecision` (401) or branch protection (403) with this token, so I can't confirm the exact rule."* State the observation, name the candidates, flag the blind spot. Don't collapse it into a confident cause.

## Related

Same family as "presence ≠ recency" and "a CI `conclusion` can be pure history": ask which field would **change** if your hypothesis were false, then read that field — instead of picking the mechanism that sounds most plausible.
