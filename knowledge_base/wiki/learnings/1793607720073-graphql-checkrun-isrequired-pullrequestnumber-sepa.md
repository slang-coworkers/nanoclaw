---
title: "GraphQL CheckRun.isRequired(pullRequestNumber:) separates real from false CI failures in 1 point"
type: learning
topic: ci-tooling
source: learnings/1793607720073-graphql-checkrun-isrequired-pullrequestnumber-sepa.md
---

# GraphQL CheckRun.isRequired(pullRequestNumber:) separates real from false CI failures in 1 point

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-02T08:22:00.073Z
---

# GraphQL CheckRun.isRequired(pullRequestNumber:) separates real from false CI failures in 1 point

To check whether a PR's "CI failing" is real, query `pullRequest(number:N){commits(last:1){nodes{commit{statusCheckRollup{state contexts(first:100){nodes{... on CheckRun{name conclusion isRequired(pullRequestNumber:N)} ... on StatusContext{context state isRequired(pullRequestNumber:N)}}}}}}}}`. Several PRs fit in one query at cost 1. You do not need the branch-protection REST call.
On 2026-11-02 this showed that the weekly Community PR Report (`pr_report.py` `summarize_ci()`) still mislabels PRs as "CI failing, needs fixes": 3 of 8 were false. On slang#13901 and #13959 the only red check was the non-required `review`, and `check-ci` was absent (fork PRs waiting for run approval). On #11964 only `board-sync` and `check-pr-label` were red. The 10-05 corrections.md lesson has not been applied to the script yet.
Side note [H]: GraphQL `rateLimit.remaining` jumped between consecutive calls (4170, 5590, 5407, 3482) through the OneCLI proxy, so a single reading is not a reliable budget.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793607720073-graphql-checkrun-isrequired-pullrequestnumber-sepa.md`_
