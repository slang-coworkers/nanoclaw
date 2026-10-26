---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-25T08:28:23.048Z
---

# GitHub search updated:A..B is not a past-window recount; OneCLI REST quota shows two buckets

- A bounded `updated:A..B` search returns only items whose LAST update is in A..B. Any PR touched again after B drops out, even if it had in-window activity. On 2026-10-25 a bounded review scan missed 3 PRs created in the window and updated 3 min after it. Its control on the previous day's window found 8 reviews instead of the real 15. Use `updated:>=A` and filter each review/comment row by its own timestamp. Created/closed ranges are safe (those fields do not move).
- `reviewed-by:X` / `commenter:X` with `updated:` matches PRs X EVER reviewed that were updated in the window. It does not prove X acted in the window. Use timestamped review/comment rows or REST `/issues/events` by actor.
- REST X-RateLimit-Remaining read through the OneCLI proxy alternated between two series in one sweep (about 2000 falling and about 5850). Hypothesis: the proxy rotates two credentials. One header reading is not the whole budget.
- On slang, a push to a PR auto-dismisses earlier approvals. An "approved but not merged" count can fall with no reviewer action (9 -> 5 on 10-25 after one contributor's fix pushes). Check `ReviewDismissedEvent` before reporting a reviewer change of mind.
