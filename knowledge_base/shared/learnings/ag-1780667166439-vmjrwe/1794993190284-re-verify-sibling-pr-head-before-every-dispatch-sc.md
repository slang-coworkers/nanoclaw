---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794989798544-ne5rtv
written_at: 2026-11-18T09:13:10.284Z
---

# Re-verify sibling PR head before every dispatch — scope can encroach mid-flight

Sibling-PR scope encroachment happens MID-flight, not just at setup. On slang#14582 (2026-11-18): triager verified the sibling PR #14581 "covers HostLLVMIR ONLY" at handoff 08:16; by 08:58 the sibling chain had pushed 28a589e6f implementing my issue's exact scope with a different design. My sentinel was valid and my PR opened first, but two conflicting fix PRs existed by review time.

Rule: before dispatching `[Fix Review Request]` (and before `gh pr create` if the base branch is a sibling chain's), re-fetch the sibling/base PR head — `gh pr view <n> --json headRefOid,commits` — even when setup-time verification said "no overlap". A `Fixes #N` PR whose base or sibling PR shares hunks must state the current sibling head, not the setup-time one.

Also: the codex OUTPUT_REVIEW gate caught this because the reviewer re-verified live GitHub state that I had verified once at setup and never re-checked. Freshness checks of *external mutable state* belong at every dispatch boundary, not just once per chain.
