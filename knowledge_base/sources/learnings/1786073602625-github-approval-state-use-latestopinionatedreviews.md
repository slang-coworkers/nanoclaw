# GitHub approval state: use latestOpinionatedReviews, never latestReviews — a later COMMENTED hides a live APPROVED

**If you ask "is this PR still approved?" via GraphQL `latestReviews`, you will get the wrong answer whenever the approver later left a plain comment-review.**

`latestReviews` returns each reviewer's *single most recent* review of any kind. If a maintainer APPROVED and then submitted a `COMMENTED` review (e.g. leaving an inline note), only the COMMENTED appears — **the APPROVED is absent entirely.** A session checking there concludes they never approved.

Real case (shader-slang/slang#12186, both reviews bound to the same current head):
```
latestReviews            → pdeayton COMMENTED (4859985747, 08-05), jkwak CHANGES_REQUESTED
latestOpinionatedReviews → pdeayton APPROVED (4849248355, 08-03), jkwak CHANGES_REQUESTED
```

**Use `latestOpinionatedReviews`.** "Opinionated" = `APPROVED` / `CHANGES_REQUESTED` only; it drops non-opinionated COMMENTED reviews and returns each reviewer's live *verdict*. **A later COMMENTED from the same author does not retract an APPROVED.**

Prefer it over hand-filtering the full review list. Filtering `/pulls/<n>/reviews` by author also works, but it is more code and you must then re-implement "which verdict is live" yourself — whereas this is the field whose definition already is that. If you do filter the full list: assert `rows == totalCount` before trusting a tally (a `--paginate --jq` filter applies **per page** and silently under-reports), and check each row's bound `commit` — a `DISMISSED` at a *stale* commit is not a dismissal at head.

Also check the bound commit on the verdict itself: an APPROVED bound to the current head has not been push-invalidated; one bound to an older commit has.

**The generalizable rule:** when an API offers two similarly-named collections, one is usually "most recent event" and the other "current state" — and they disagree precisely in the interesting cases. Pick the field whose *definition* matches your question, and be suspicious of any field whose name describes **recency** when you actually need **state**. (Same family as: a field whose name implies a state is not a test for it — e.g. `started_at` is populated on jobs that never started.)

**Scope caveat, separate but adjacent:** don't inherit a *route* from a higher-scoped peer without re-establishing its domain on your own edge. A cross-group `sessions list --thread-id` query that a parent verified returned `[]` for me — **identical to my own negative control** — because the flag set at my `cli_scope: group` has no `--group`/`--all`. An empty result that equals your negative control is a **failed measurement**, not a finding: say "unmeasured from my edge," never "absent."
