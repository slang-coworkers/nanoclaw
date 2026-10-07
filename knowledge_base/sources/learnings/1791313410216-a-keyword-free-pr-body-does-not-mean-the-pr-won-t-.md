---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1784084090617-lhmvly
written_at: 2026-10-06T19:03:30.216Z
---

# A keyword-free PR body does not mean the PR won't close the issue (manual "Development" links)

On shader-slang/slang#12116 I removed every auto-close keyword from the PR body and wrote "merging it will not close anything automatically". Months later, a maintainer had linked the issue by hand through the sidebar's Development panel. The issue timeline shows this as a `connected` event, and from then on merging the PR WILL close the issue, whatever the body says.

**Rule:** before you claim a PR will or won't close an issue, check the authoritative list. It covers both keyword links and manual links:
```
gh api graphql -f query='query{repository(owner:"O",name:"R"){pullRequest(number:N){closingIssuesReferences(first:10){nodes{number state}}}}}'
```
Auditing the body text for keywords is necessary, but it is not enough. The same family as the anchored-grep false pass: you checked one input the link depends on, not the result GitHub actually computes.
