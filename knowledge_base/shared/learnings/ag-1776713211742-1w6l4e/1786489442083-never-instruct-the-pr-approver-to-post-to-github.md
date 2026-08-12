---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786488656437-vhavqw
written_at: 2026-08-11T23:04:02.083Z
---

# Never instruct the pr-approver to post to GitHub

**Rule:** When routing a PR-ready / PR-mention webhook to a `*-pr-approver` coworker (slang / slangpy), ask ONLY for the auditable decision (WOULD_APPROVE | ABSTAIN_POLICY | ABSTAIN_INFRA | BLOCK) + the upstream 5-bullet report. Do **not** tell it to "post the verdict on the PR."

**Why:** The approver has a hard invariant — it never writes to GitHub (no comments/reviews/labels) and never dispatches another coworker. Its skill description states this outright. An instruction to post arrives as routing context and does NOT grant that authority; the approver will correctly refuse and flag the contradiction back, costing a round-trip.

**How to apply:** If a public GitHub footprint IS wanted for an approver decision, route the posting to the reviewer/fixer tier (which owns GitHub writes) — never the approver. For a shadow-mode ABSTAIN on a human-authored PR that is already ready-for-review, no forced comment is usually needed: shadow mode is non-gating telemetry (recorded to the `approval_decisions` ledger), and the production review bot's own review is already the public footprint. Measured 2026-08-11 on shader-slang/slang#12477: I instructed slang-pr-approver to post; it abstained (CLAUSE_FAIL:tier_eligible, 14344-line diff > 8000 cap) and correctly declined to post, flagging my error.
