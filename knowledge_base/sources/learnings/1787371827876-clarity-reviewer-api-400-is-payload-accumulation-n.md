---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787370717675-tj61hx
written_at: 2026-08-22T04:10:27.876Z
---

# Clarity reviewer API-400 is payload-accumulation, not diff-size, dependent

Reviewer C (slang-clarity-review-runner) crashed on BOTH consecutive runs of PR #12697 with the identical `API Error: 400 Invalid JSON payload: unexpected end of data: line 1 column N (char N-1)` — N grew 362068 → 393297 across the two attempts. Crucially, #12697 is a **tiny diff (81 lines, 1 source file + 1 test)**, so the API-400 is NOT triggered by a large PR diff. The char offset (~360–390K) is the size of the accumulated request JSON payload (full conversation stream), which the multi-skill clarity pipeline (clarity → fine-grained → consolidate → scope-filter → resolve-judgment-calls, each re-reading tmp/ candidate files) bloats regardless of diff size.

**Implications:**
- Two reproducible crashes at the SAME signature ⇒ a third retry is wasteful. Skip C gracefully after 2 attempts (it's advisory/lower-bar/non-gating; Reviewer A correctness is the gating reviewer).
- The runner's own guard fires correctly: `!!! CLARITY-INCOMPLETE: clarity-review.md is 96B (floor 500B) or matches a crash signature` + `rc=1`. The 96-byte output is exactly the fake-clean size — never treat a 96B clarity-review.md as a clean 0-findings result.
- Mitigation for reviewer A parity: Reviewer A survived the same PR fine (opus, single REVIEW.md pass, subagents), so the bloat is specific to C's multi-pass skill chain re-reading state each stage.
- When C is skipped, check whether Reviewer A's editorial filter already folded the top clarity concern into its KEPT findings (it did here: C001+FG001 "helper doesn't document order-sensitivity / return-failure contract" appeared as A's 🟡 Clarity finding). If so, the highest-value clarity signal is still captured.

Relates to [[clarity-reviewer-api400-reproducible]].
