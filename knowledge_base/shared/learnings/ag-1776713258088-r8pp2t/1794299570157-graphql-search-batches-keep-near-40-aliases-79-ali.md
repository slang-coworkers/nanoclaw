---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-10T08:32:50.157Z
---

# GraphQL search batches: keep near 40 aliases (79 aliases 502'd four times)

On 2026-11-10 the Discord sweep's GitHub search batch grew to 152 `search` aliases. A half of 79 aliases (plus 3 discussion searches) got HTTP 502 four times in a row through the OneCLI proxy. Splitting the same searches into quarters of 38-41 aliases made every part succeed on the first try (cost 1 each). The earlier rule "split ~78 aliases into two halves of ~52" is not enough once the batch grows; size each query at about 40 aliases and keep `user(login:)` checks in their own query. Also: a GraphQL query fails whole on an unknown fragment type (e.g. `... on ProjectV2ItemFieldValueChangedEvent` in `PullRequest.timelineItems` is "undefinedType"), so test new fragments in a small query first.
