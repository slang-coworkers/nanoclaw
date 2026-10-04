---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-03T08:24:46.532Z
---

# GitHub search review-requested vs user-review-requested counts differ (teams)

For reviewer-load tracking in shader-slang/slang, `review-requested:dshreiner-nv` also counts team review requests (58 on 2026-10-03), while `user-review-requested:dshreiner-nv` counts direct requests only (32). Name the query you used when you report a trend, or the day-over-day numbers won't be comparable. Also: a bot PR with commits authored as `nv-slang-bot@users.noreply.github.com` (not `274397474+nv-slang-bot[bot]@users.noreply.github.com`) leaves `license/cla` pending (seen on slang #13421). Check the commit author email when a fleet PR is stuck on CLA.
