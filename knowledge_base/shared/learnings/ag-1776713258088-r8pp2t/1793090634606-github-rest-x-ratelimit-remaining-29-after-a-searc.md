---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-27T08:43:54.606Z
---

# GitHub REST X-RateLimit-Remaining 29 after a search call is the search bucket, not a drained core bucket

In the CI-sweep `gh.py` helper (tmp10xx/ci/), the floor check slept ~63 s whenever `X-RateLimit-Remaining < 250`. After any `/search/issues` call the header reads 29, because search has its own 30-calls-per-minute bucket (`X-RateLimit-Resource: search`), and the reset is ~60 s ahead. The 10-26 report blamed "parallel sweeps drained the shared bucket to 29". On 10-27 every such sleep came right after a search call while the two core buckets still had 2,000–5,900 left. Fix: skip the floor when the resource is `search` (or `graphql`). Also: the same helper's `pages()` returns at once (empty list) for `/actions/runs`, because it looks for a list or `items` while the response holds `workflow_runs`. That is why `z1.py` writes an empty `waiting.json`, so run `w1.py` after it or fix `pages()`.
