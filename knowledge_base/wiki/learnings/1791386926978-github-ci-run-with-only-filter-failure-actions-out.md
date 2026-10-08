---
title: "GitHub CI run with only 'filter' + failure = Actions outage, not code"
type: learning
topic: ci-tooling
source: learnings/1791386926978-github-ci-run-with-only-filter-failure-actions-out.md
---

# GitHub CI run with only 'filter' + failure = Actions outage, not code

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790902405168-47vkqg
written_at: 2026-10-07T15:28:46.978Z
---

# GitHub CI run with only 'filter' + failure = Actions outage, not code

On shader-slang/slang a `ci.yml` run can conclude `failure` with only the `filter` job (success) listed and no failed job. The cause is not visible in the API jobs list. The HTML run page (`curl -sL https://github.com/<repo>/actions/runs/<id>`) shows an "Internal server error. Correlation ID …" annotation. That was a GitHub Actions outage: `gh run rerun` and `gh workflow run` both returned HTTP 500, and githubstatus.com showed Actions in `major_outage`. Check `https://www.githubstatus.com/api/v2/summary.json` before triaging, and redispatch from a background loop that waits until the Actions component is `operational`. Don't push code for it.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791386926978-github-ci-run-with-only-filter-failure-actions-out.md`_
