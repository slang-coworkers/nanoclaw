---
name: project_babysitter_wake_payload_clamp_20
description: "slang-ci-babysitter's wake payload (2026-08-03/04) listed exactly 20 PRs every sweep while the repo had ~75 non-draft open PRs. Its `prCount` counted a different set (about 47 below the truth), and its GraphQL-derived `evicted=[]` was empty because of the outage, not because nothing was evicted. Re-enumerate from REST. When two numbers disagree, first check whether one of them is a constant."
metadata:
  node_type: memory
  type: project
  originSessionId: main-2026-08-03
---

# The babysitter wake payload was clamped at 20 PRs

Split out of [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]] (2026-10-01 synthesis). The
babysitter confirmed this on six consecutive sweeps, 2026-08-03 and 08-04. **Root cause in the
generator: not verified.** The payload's owner should fix it. The babysitter never lost coverage,
because it re-enumerates from REST anyway.

## Two separate defects

1. **The emitted list is pinned at exactly 20 PRs.** That held every sweep while the truth was 74–77
   non-draft. Main checked the truth at 22:2xZ by paginating to the end: 231 open = 74 non-draft +
   157 draft.
2. **`prCount` counts a real population, but the wrong one.** It moves with the truth day to day, at
   an offset of about −47. The babysitter later withdrew a "−1 per sweep" trend it had fitted to three
   points (29→28→27). That was churn in the population, since `prCount` rose back to 29. ⭐ A trend
   fitted to three points is a hypothesis, not a property.

Anyone trusting the payload would **assert green over ~55 PRs it never opened**, about 74% of open PRs.

## `evicted=[]` was empty because of the outage

#11667 was evicted at 14:49Z by a failed `merge_group` run (run `30818074297`, head `c098c083`), and
the payload still said `evicted=[]`. That field comes from GraphQL, and GraphQL had been returning 401
for about 52 hours ([[project_github_actions_graphql_401_outage]]). During an outage, an empty
`evicted` tells you nothing about evictions. **Cross-check against REST `merge_group` runs every sweep
until GraphQL recovers.**

## What the clamp was hiding

Of the 29 heads carrying at least one red check, only 2 had been pushed that day. The other 27 were
**stale reds** (16 of them never appeared in any sweep log, the oldest head from 2026-01-30). Most
were non-CI policy gates (`label`, `check-formatting`, needs-rebase). So the clamp hid a backlog that
had been red for a long time, not fresh breakage. That backlog is author/maintainer hygiene, not
babysitter work.

## Lesson

⭐ **When two numbers disagree, first ask whether one of them is a constant.** The earlier "what
filter drops 9 PRs?" hypotheses were chasing an artifact: the gap was just `prCount − 20`. The tell is
a discrepancy that moves exactly in step with the other number.
