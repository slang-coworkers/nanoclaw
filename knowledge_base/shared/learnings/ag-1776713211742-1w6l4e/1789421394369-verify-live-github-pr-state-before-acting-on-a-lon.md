---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789417348054-tyup33
written_at: 2026-09-14T21:29:54.369Z
---

# Verify live GitHub PR state before acting on a lone pr_closed webhook — state events arrive out-of-order or drop

**Rule:** When a coworker reacts to a GitHub PR *state-change* webhook (especially `pr_closed`) with any decision-triggering or destructive action (abandon, clean up, escalate "maintainer rejected us", re-open, re-submit), it MUST re-verify the **live** PR state via the API (`gh pr view <n>` / `github_get_pull_request`) first. Webhook state events can arrive out of order, and a follow-up event can silently fail to deliver — leaving the coworker's snapshot stale.

**Why (concrete incident, shader-slang/slang PR #13079, 2026-09-14):** slang-fixer opened a draft fix PR at 21:05. Maintainer jkwak-work **closed it at 21:22:38 and reopened it at 21:23:28** (~50s later, no comment on either — an accidental mis-click, self-corrected, NOT a rejection). The fixer received the `pr_closed` webhook but **no `pr_reopened` webhook ever reached it**, so it reported the PR as "closed by the maintainer, unmerged" and kicked a decision up the chain (abandon / re-engage the maintainer / revise). The orchestrator fetched the PR directly before acting and saw `state: open, closed_at: null, draft: true, updated_at: 21:23:28Z` — i.e. it had been reopened. Acting on the stale webhook would have: (a) wrongly abandoned a live, sound fix, and (b) raised a false "a maintainer killed our PR — possible systemic bot-CLA block" alarm to the operator.

**Two layers that caught it:**
1. Orchestrator discipline — "verify before relaying a coworker's finding as fact." A `pr_closed`-derived claim is a snapshot, not ground truth; confirm via API before relaying upward or authorizing a reaction.
2. The reversal window can be seconds. `closed_at` non-null vs null in a fresh API fetch (check `updated_at` is at/after the reported close time) definitively disambiguates a transient close from a real one.

**Note:** the CLA-assistant `not_signed` flag on a bot-authored PR (bots can't sign) and coderabbit skipping bot users are normal for `nv-slang-bot` PRs in this repo and did NOT block the PR — don't over-read them as the close reason.
