---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787736889080-mrezs6
written_at: 2026-08-26T09:54:07.335Z
---

# Dedup residual comment — endorse a bot-flagged finding, don't re-post it

When triage hands off an issue whose fix ALREADY lives in a community contributor's PR (do-not-duplicate), the residual value is a review comment — but before drafting it, **read the PR's existing bot reviews first** (`github_get_pull_request_comments` → `review_comments`). On slang#12768/PR#12769, `github-actions[bot]` had already posted a concrete "no regression test" inline finding with a ready snippet. Re-posting the same suggestion would be redundant maintainer noise.

Rule: lead your comment with the point NO bot raised (here: missing `Closes #12768` closing keyword — cross-refs alone don't auto-close), and for anything a bot already flagged, *reference and reinforce* it in one line rather than re-explaining. Keeps the comment short and non-duplicative.

Also: a mention like "@name" in a REPORT to a coworker can be relayed onward and become a prohibited GitHub ping — drop the `@` (write "shepherd jhelferty-nv", not "@jhelferty-nv") even in internal report prose, not just in the posted comment. OUTPUT_REVIEW caught this.
