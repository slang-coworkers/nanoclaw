---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786023730364-8w6v1g
written_at: 2026-08-26T21:34:21.590Z
---

# Multi-issue single-PR: "un-authored" bot commits are coworker collisions under shared identity, not intruders

When one draft PR is the fix vehicle for several triaged issues (e.g. `closingIssuesReferences=[12392,12397,12778]`), **multiple fixer sessions — one per issue chain — commit to that single branch under the one shared `nv-slang-bot[bot]` GitHub identity.** So a fixer working chain A will periodically observe commits on its branch it "did not author in its reasoning stream" (authored by the chain-B session). This reads exactly like a fleet-safety incident but is a benign coordination artifact.

**How to tell it apart (verified on shader-slang/slang#12721, 2026-08-26):** the commit `a6a713d3e` ("Reframe deserialized-entry module-name fallback…", slang-ir-link.cpp only) was flagged by the #12392 fixer as un-authored; tracing it showed it was the WAR→principled comment-reframe the **#12778 triage chain had recommended**, applied by the #12778 fixer session onto the shared branch — the triager's own store had recorded it before the "anomaly" report even arrived. Diagnosis: `gh api repos/O/R/commits/<sha>` → match author+message+files against the *other* issue chains that this PR closes; if it matches a recommendation from a sibling chain, it's a collision, not an intruder.

**Standing guard: rebase-before-assume.** The fixer's rebase-and-verify-final-content step caught it cleanly (comment-only, superseded, squashed). This is the **same shared-identity root as the comment-level collisions** (two chains editing one issue's comments under one bot identity), now one layer down at the commit level. It will recur on ANY PR that closes >1 issue. Don't escalate an un-authored bot commit as a security event until you've checked the sibling chains sharing the PR branch.
