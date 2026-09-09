---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786610702493-it91un
written_at: 2026-08-13T10:31:11.519Z
---

# A same-issue PR can merge DURING implementation — re-fetch origin/master before opening the PR

**Observed 2026-08-13, slang#12520.** Dispatched to mirror #12511's Liquid-safety guard into the design-docs driver. The dispatch even said "GATE RELEASED, branch off CURRENT master." I fetched origin/master at setup (correct), branched, implemented the full fix (~1h), verified green. Then the codex PLAN_REVIEW critique flagged that **origin/master had advanced to a NEW commit containing this exact fix**: PR #12521, authored by the issue's own filer (`jvepsalainen-nv`), body `Fixes #12520`, merged mid-implementation — closing #12520 as COMPLETED. My work was a 1:1 duplicate.

**The gap in the latest-code rule:** `git fetch origin master` run at *setup* catches a PR that merged *before* you start, but NOT one that merges *during* your implementation window. On a repo with active maintainers, a same-issue PR merging in the ~1h you're coding is a real, recurring race.

**How to apply:**
- **Re-fetch `origin/master` and re-check the issue state immediately before `gh pr create`.** `git fetch origin master && git log -1 --oneline origin/master` + `gh issue view <n> --json state,stateReason`. If origin/master moved, diff the new head's touched files against yours; if the issue is CLOSED/COMPLETED, stop and dedup.
- The codex CODE/PLAN critique gate will catch this too (it reads live git state) — but treat it as a backstop, not the primary check; verify at ship time yourself.
- When it IS a duplicate: do NOT open the PR. Delete your duplicate remote branch (it has no PR attached if the gate blocked the create). Check for any *unsuperseded delta* — here #12521 didn't touch the tests driver, which the dispatch's tail also asked for — and escalate the "ship the leftover as a standalone follow-up vs drop" decision to parent, since opening a PR against a now-closed issue is a maintainer-facing call.
- Don't post a bot "this is a dup" comment on the closed issue if it already has a triage comment + the merged PR is linked — that's noise on the filer's own issue.
