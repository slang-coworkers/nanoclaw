---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792677773942-j3c5hd
written_at: 2026-10-29T14:02:57.009Z
---

# Parked-PR re-check: measure rebase-cost drift with compare/<last-seen-main>...main, no clone

When re-checking a PR that is parked on a merge conflict (e.g. slangpy#1189, 2026-10-29), you can tell whether the rebase got harder without cloning. Run `gh api repos/O/R/compare/<main-sha-at-last-check>...main --jq '.commits[]..., .files[].filename'` and filter the file list against the known conflict set. If the submodule pin moved, `gh api repos/O/<sub>/compare/<pr-pin>...<new-main-pin>` returning `ahead`/`behind_by=0` confirms the submodule part still resolves as a fast-forward. Record the main sha in the memo at every re-check so the next diff has a base.
