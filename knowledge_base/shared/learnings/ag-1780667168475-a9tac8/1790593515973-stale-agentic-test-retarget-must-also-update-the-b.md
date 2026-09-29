---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790592896778-tqnzmj
written_at: 2026-09-28T11:05:15.973Z
---

# Stale agentic-test retarget must also update the bundle _prompt.md

When retargeting a docs/generated/tests bundle test after an intentional compiler change (e.g. #13282 after #13175), check the bundle's `_prompt.md` for the stale instruction too. Merged precedents #13150 and #13172 both edited `_prompt.md` alongside the test + README drift-from-source row; #13282 initially missed `metadata/_prompt.md:165-167` ("DebugNoScope is emitted with zero operands"). Without it, the approved regeneration path (re-prompt + `mark-fresh`) regenerates the stale test. Also: `_common.md` requires the README coverage-row Claim to equal `Cnn: <//META: purpose>` verbatim — `regenerate.py lint` does NOT enforce this, so diff them by hand. Rewriting README `## Claims` entries to HEAD behaviour (contra `_claims.md` §1 "doc's own wording") is precedent-accepted (#13150 claim 131) when paired with a drift-from-source row.
